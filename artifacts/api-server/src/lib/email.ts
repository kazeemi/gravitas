import { Resend } from "resend";
import { logger } from "./logger.js";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = "Gravitas <noreply@selfcraftpartners.com>";

function getAppUrl(): string {
  if (process.env.APP_URL) return process.env.APP_URL;
  const domains = process.env.REPLIT_DOMAINS;
  if (domains) {
    const primary = domains.split(",")[0].trim();
    return `https://${primary}`;
  }
  return "http://localhost:80";
}

export async function sendVerificationEmail(to: string, name: string, token: string): Promise<void> {
  const url = `${getAppUrl()}/verify-email?token=${token}`;
  const { error } = await resend.emails.send({
    from: FROM,
    to,
    subject: "Verify your Gravitas account",
    headers: {
      "X-Entity-Ref-ID": `verify-${token.slice(0, 8)}`,
    },
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Verify your Gravitas account</title>
</head>
<body style="margin:0;padding:0;background:#FBF7F2;font-family:Inter,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FBF7F2;padding:40px 16px;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(15,27,45,0.08);">
        <tr>
          <td style="background:#0F1B2D;padding:28px 40px;text-align:center;">
            <span style="font-family:Georgia,serif;font-size:24px;font-weight:600;color:#FBF7F2;letter-spacing:0.5px;">Gravitas</span>
          </td>
        </tr>
        <tr>
          <td style="padding:40px 40px 32px;">
            <p style="margin:0 0 8px;font-size:22px;font-weight:600;color:#0F1B2D;">Welcome, ${name.split(" ")[0]}.</p>
            <p style="margin:0 0 28px;font-size:15px;color:#4B5563;line-height:1.6;">
              You're one step away from your first session. Click the button below to verify your email address and activate your account.
            </p>
            <table cellpadding="0" cellspacing="0" style="margin:0 auto 28px;">
              <tr>
                <td style="background:linear-gradient(120deg,#F0953E 0%,#C84A18 100%);border-radius:8px;">
                  <a href="${url}" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:0.2px;">
                    Verify my email
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:0 0 6px;font-size:13px;color:#9CA3AF;">This link expires in 24 hours. If you didn't create a Gravitas account, you can safely ignore this email.</p>
            <p style="margin:0;font-size:12px;color:#D1D5DB;word-break:break-all;">Or copy this URL: ${url}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 40px;border-top:1px solid #F3F0EC;text-align:center;">
            <p style="margin:0;font-size:12px;color:#9CA3AF;">© ${new Date().getFullYear()} Gravitas. Executive Presence, Elevated.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  });
  if (error) {
    logger.error({ err: error, to }, "Failed to send verification email");
    throw new Error("Failed to send verification email");
  }
  logger.info({ to }, "Verification email sent");
}

export async function sendPasswordResetEmail(to: string, name: string, token: string): Promise<void> {
  const url = `${getAppUrl()}/reset-password?token=${token}`;
  const { error } = await resend.emails.send({
    from: FROM,
    to,
    subject: "Reset your Gravitas password",
    headers: {
      "X-Entity-Ref-ID": `reset-${token.slice(0, 8)}`,
    },
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reset your Gravitas password</title>
</head>
<body style="margin:0;padding:0;background:#FBF7F2;font-family:Inter,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FBF7F2;padding:40px 16px;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(15,27,45,0.08);">
        <tr>
          <td style="background:#0F1B2D;padding:28px 40px;text-align:center;">
            <span style="font-family:Georgia,serif;font-size:24px;font-weight:600;color:#FBF7F2;letter-spacing:0.5px;">Gravitas</span>
          </td>
        </tr>
        <tr>
          <td style="padding:40px 40px 32px;">
            <p style="margin:0 0 8px;font-size:22px;font-weight:600;color:#0F1B2D;">Password reset</p>
            <p style="margin:0 0 28px;font-size:15px;color:#4B5563;line-height:1.6;">
              Hi ${name.split(" ")[0]}, we received a request to reset your password. Click the button below to choose a new one.
            </p>
            <table cellpadding="0" cellspacing="0" style="margin:0 auto 28px;">
              <tr>
                <td style="background:linear-gradient(120deg,#F0953E 0%,#C84A18 100%);border-radius:8px;">
                  <a href="${url}" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:0.2px;">
                    Reset my password
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:0 0 6px;font-size:13px;color:#9CA3AF;">This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email — your password won't change.</p>
            <p style="margin:0;font-size:12px;color:#D1D5DB;word-break:break-all;">Or copy this URL: ${url}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 40px;border-top:1px solid #F3F0EC;text-align:center;">
            <p style="margin:0;font-size:12px;color:#9CA3AF;">© ${new Date().getFullYear()} Gravitas. Executive Presence, Elevated.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  });
  if (error) {
    logger.error({ err: error, to }, "Failed to send password reset email");
    throw new Error("Failed to send password reset email");
  }
  logger.info({ to }, "Password reset email sent");
}
