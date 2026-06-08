import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { eq } from "drizzle-orm";
import { db } from "../lib/db.js";
import { signToken, requireAuth } from "../lib/auth.js";
import { usersTable } from "@workspace/db";
import { sendVerificationEmail, sendPasswordResetEmail } from "../lib/email.js";
import { logger } from "../lib/logger.js";

const router = Router();

router.post("/v1/auth/signup", async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ error: "email, password and name are required" });
  }
  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase())).limit(1);
  if (existing.length > 0) {
    return res.status(409).json({ error: "Email already registered" });
  }
  const passwordHash = await bcrypt.hash(password, 12);
  const verificationToken = crypto.randomBytes(32).toString("hex");
  const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const [user] = await db.insert(usersTable).values({
    email: email.toLowerCase(),
    name,
    passwordHash,
    emailVerified: false,
    emailVerificationToken: verificationToken,
    emailVerificationExpiresAt: verificationExpires,
  }).returning();

  try {
    await sendVerificationEmail(user.email, user.name ?? "there", verificationToken);
  } catch (err) {
    logger.error({ err, userId: user.id }, "Failed to send verification email after signup");
  }

  return res.status(201).json({ message: "Account created. Please check your email to verify your account." });
});

router.post("/v1/auth/verify-email", async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: "token is required" });

  const [user] = await db.select().from(usersTable).where(eq(usersTable.emailVerificationToken, token)).limit(1);
  if (!user) return res.status(400).json({ error: "Invalid or expired verification link" });

  if (user.emailVerificationExpiresAt && user.emailVerificationExpiresAt < new Date()) {
    return res.status(400).json({ error: "Verification link has expired. Please sign up again." });
  }

  await db.update(usersTable).set({
    emailVerified: true,
    emailVerificationToken: null,
    emailVerificationExpiresAt: null,
  }).where(eq(usersTable.id, user.id));

  return res.json({ message: "Email verified successfully" });
});

router.post("/v1/auth/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase())).limit(1);
  if (!user || !user.passwordHash) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  if (!user.emailVerified) {
    return res.status(403).json({ error: "email_not_verified", message: "Please verify your email before signing in. Check your inbox for a verification link." });
  }
  const token = signToken({ userId: user.id, email: user.email, isAdmin: user.isAdmin });
  return res.json({ token, user: { id: user.id, email: user.email, name: user.name, isAdmin: user.isAdmin, onboardingCompleted: user.onboardingCompleted } });
});

router.post("/v1/auth/logout", requireAuth, (_req, res) => {
  res.json({ message: "Logged out" });
});

router.post("/v1/auth/forgot-password", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "email is required" });

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase())).limit(1);

  if (user) {
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000);
    await db.update(usersTable).set({
      passwordResetToken: resetToken,
      passwordResetExpiresAt: resetExpires,
    }).where(eq(usersTable.id, user.id));

    try {
      await sendPasswordResetEmail(user.email, user.name ?? "there", resetToken);
    } catch (err) {
      logger.error({ err, userId: user.id }, "Failed to send password reset email");
    }
  }

  return res.json({ message: "If that email exists, a reset link was sent" });
});

router.post("/v1/auth/reset-password", async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ error: "token and password are required" });
  if (password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });

  const [user] = await db.select().from(usersTable).where(eq(usersTable.passwordResetToken, token)).limit(1);
  if (!user) return res.status(400).json({ error: "Invalid or expired reset link" });

  if (user.passwordResetExpiresAt && user.passwordResetExpiresAt < new Date()) {
    return res.status(400).json({ error: "Reset link has expired. Please request a new one." });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await db.update(usersTable).set({
    passwordHash,
    passwordResetToken: null,
    passwordResetExpiresAt: null,
  }).where(eq(usersTable.id, user.id));

  return res.json({ message: "Password reset successfully" });
});

router.post("/v1/auth/google", async (req, res) => {
  const { credential } = req.body;
  if (!credential) {
    return res.status(400).json({ error: "credential is required" });
  }
  try {
    const tokenInfoRes = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`
    );
    if (!tokenInfoRes.ok) {
      return res.status(401).json({ error: "Invalid Google token" });
    }
    const tokenInfo = await tokenInfoRes.json() as {
      email?: string;
      name?: string;
      given_name?: string;
      family_name?: string;
      sub?: string;
      aud?: string;
    };

    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (clientId && tokenInfo.aud !== clientId) {
      return res.status(401).json({ error: "Token audience mismatch" });
    }

    if (!tokenInfo.email) {
      return res.status(401).json({ error: "No email in Google token" });
    }

    const email = tokenInfo.email.toLowerCase();
    const name = tokenInfo.name || tokenInfo.given_name || email.split("@")[0];

    let [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    if (!user) {
      [user] = await db.insert(usersTable).values({ email, name, emailVerified: true }).returning();
    }

    const token = signToken({ userId: user.id, email: user.email, isAdmin: user.isAdmin });
    return res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, isAdmin: user.isAdmin },
      isNewUser: !user.onboardingCompleted,
    });
  } catch {
    return res.status(401).json({ error: "Google authentication failed" });
  }
});

router.post("/v1/auth/change-password", requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "currentPassword and newPassword are required" });
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId)).limit(1);
  if (!user?.passwordHash) return res.status(404).json({ error: "User not found" });
  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) return res.status(401).json({ error: "Current password is incorrect" });
  const passwordHash = await bcrypt.hash(newPassword, 12);
  await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, user.id));
  return res.json({ message: "Password changed successfully" });
});

export default router;
