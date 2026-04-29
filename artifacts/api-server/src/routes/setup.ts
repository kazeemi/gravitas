import { Router } from "express";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "../lib/db.js";
import { usersTable } from "@workspace/db";

const router = Router();

// One-time admin bootstrap endpoint.
// Protected by SETUP_SECRET env var — must be removed after first use.
router.post("/v1/setup/admin", async (req, res) => {
  const secret = process.env.SETUP_SECRET;
  if (!secret) {
    return res.status(404).json({ error: "Not found" });
  }
  const { token, email, password } = req.body;
  if (!token || token !== secret) {
    return res.status(403).json({ error: "Forbidden" });
  }
  if (!email || !password) {
    return res.status(400).json({ error: "email and password required" });
  }
  const passwordHash = await bcrypt.hash(password, 12);
  const [user] = await db
    .update(usersTable)
    .set({ isAdmin: true, passwordHash })
    .where(eq(usersTable.email, email.toLowerCase()))
    .returning({ id: usersTable.id, email: usersTable.email, isAdmin: usersTable.isAdmin });
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }
  return res.json({ ok: true, user });
});

export default router;
