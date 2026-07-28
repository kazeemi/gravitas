import { Resend } from "resend";
import { logger } from "./logger.js";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = "Gravitas <noreply@selfcraftpartners.com>";
const FROM_KANZA = "Kanza Azeemi <kanza@selfcraftpartners.com>";

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

export async function sendDeletionConfirmationEmail(to: string, name: string, restoreToken: string): Promise<void> {
  const deletionDate = new Date();
  deletionDate.setDate(deletionDate.getDate() + 30);
  const formattedDate = deletionDate.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const restoreUrl = `${getAppUrl()}/restore-account?token=${restoreToken}`;

  const { error } = await resend.emails.send({
    from: FROM,
    to,
    subject: "Your Gravitas account has been deactivated",
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Account deletion request</title>
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
            <p style="margin:0 0 8px;font-size:22px;font-weight:600;color:#0F1B2D;">Your account has been deactivated</p>
            <p style="margin:0 0 20px;font-size:15px;color:#4B5563;line-height:1.6;">
              Hi ${name.split(" ")[0]}, we've received your request to delete your Gravitas account. It has been deactivated and all your data will be permanently erased on <strong style="color:#0F1B2D;">${formattedDate}</strong>.
            </p>
            <p style="margin:0 0 28px;font-size:15px;color:#4B5563;line-height:1.6;">
              Changed your mind? You can restore your account at any time before ${formattedDate} — everything will be exactly as you left it.
            </p>
            <table cellpadding="0" cellspacing="0" style="margin:0 auto 28px;">
              <tr>
                <td style="background:linear-gradient(120deg,#F0953E 0%,#C84A18 100%);border-radius:8px;">
                  <a href="${restoreUrl}" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:0.2px;">
                    Restore my account
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:0 0 6px;font-size:13px;color:#9CA3AF;line-height:1.5;">
              If you do not restore your account, all personal data — profile, session transcripts, scores, and performance metrics — will be permanently and irreversibly erased on ${formattedDate}. This cannot be undone.
            </p>
            <p style="margin:0;font-size:12px;color:#D1D5DB;word-break:break-all;">Or copy this link: ${restoreUrl}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 40px;border-top:1px solid #F3F0EC;text-align:center;">
            <p style="margin:0;font-size:12px;color:#9CA3AF;">This deletion is carried out under our <a href="${getAppUrl()}/privacy" style="color:#9CA3AF;">Privacy Policy</a>. © ${new Date().getFullYear()} Gravitas.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  });
  if (error) {
    logger.error({ err: error, to }, "Failed to send deletion confirmation email");
    throw new Error("Failed to send deletion confirmation email");
  }
  logger.info({ to }, "Deletion confirmation email sent");
}

export async function sendDeletionWarningEmail(to: string, name: string, restoreToken: string): Promise<void> {
  const restoreUrl = `${getAppUrl()}/restore-account?token=${restoreToken}`;

  const { error } = await resend.emails.send({
    from: FROM,
    to,
    subject: "Your Gravitas data will be permanently deleted in 7 days",
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Final deletion warning</title>
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
            <p style="margin:0 0 8px;font-size:22px;font-weight:600;color:#0F1B2D;">7 days until permanent deletion</p>
            <p style="margin:0 0 20px;font-size:15px;color:#4B5563;line-height:1.6;">
              Hi ${name.split(" ")[0]}, this is a reminder that your Gravitas account and all associated data will be <strong>permanently and irreversibly deleted in 7 days</strong>.
            </p>
            <p style="margin:0 0 28px;font-size:15px;color:#4B5563;line-height:1.6;">
              This is your last chance to restore your account. If you've changed your mind, click the button below — everything will be exactly as you left it.
            </p>
            <table cellpadding="0" cellspacing="0" style="margin:0 auto 28px;">
              <tr>
                <td style="background:linear-gradient(120deg,#F0953E 0%,#C84A18 100%);border-radius:8px;">
                  <a href="${restoreUrl}" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:0.2px;">
                    Restore my account
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:0;font-size:13px;color:#9CA3AF;line-height:1.5;">
              If you do not act, your data will be permanently deleted and cannot be recovered. If you intended to delete your account, no action is needed.
            </p>
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
    logger.error({ err: error, to }, "Failed to send deletion warning email");
    throw new Error("Failed to send deletion warning email");
  }
  logger.info({ to }, "Deletion warning email sent");
}

export async function sendWelcomeEmail(to: string, name: string, interviewMode: boolean): Promise<void> {
  const firstName = name.split(" ")[0];
  const appUrl = getAppUrl();

  const interviewBody = `
    <p style="margin:0 0 20px;font-size:15px;color:#0F1B2D;line-height:1.7;">Hi ${firstName},</p>
    <p style="margin:0 0 20px;font-size:15px;color:#4B5563;line-height:1.7;">
      My name is Kanza — I am the founder of Gravitas, and also an executive coach and leadership advisor to companies and governments. Before this, I spent seven years at McKinsey &amp; Company, as an Engagement Manager, People Leader and Interviewer.
    </p>
    <p style="margin:0 0 20px;font-size:15px;color:#4B5563;line-height:1.7;">
      I built Gravitas because I kept seeing the same thing: brilliant people not showing up in the room the way their ability deserved. They were ready. They just didn't always look and sound like it.
    </p>
    <p style="margin:0 0 20px;font-size:15px;color:#4B5563;line-height:1.7;">
      You are preparing for interviews. That is exactly the moment Gravitas was built for.
    </p>
    <p style="margin:0 0 28px;font-size:15px;color:#4B5563;line-height:1.7;">
      After every session, you will receive an objective, specific picture of how you actually come across: your structure, your voice quality, your vocal delivery, the dimensions of communication that shape how interviewers experience you. Gravitas is not generic feedback — it is built with consulting rigour and executive coaching depth to help you show up the way your capability deserves.
    </p>
    <p style="margin:0 0 28px;font-size:15px;color:#4B5563;line-height:1.7;">
      Your first session takes a minimum of one minute. No preparation needed — just speak.
    </p>`;

  const workplaceBody = `
    <p style="margin:0 0 20px;font-size:15px;color:#0F1B2D;line-height:1.7;">Hi ${firstName},</p>
    <p style="margin:0 0 20px;font-size:15px;color:#4B5563;line-height:1.7;">
      My name is Kanza — I am the founder of Gravitas, and also an executive coach and leadership advisor to companies and governments. Prior to Gravitas, I spent years at McKinsey &amp; Company advising public and private companies on their strategic challenges, and coaching senior leaders on their leadership challenges.
    </p>
    <p style="margin:0 0 20px;font-size:15px;color:#4B5563;line-height:1.7;">
      I built Gravitas because I kept seeing the same thing: capable, experienced professionals not landing in the room the way their ability deserved.
    </p>
    <p style="margin:0 0 20px;font-size:15px;color:#4B5563;line-height:1.7;">
      Executive presence is rarely developed with the specificity it deserves. Feedback is vague and coaching is usually exclusive. And most professionals never get an honest, objective picture of how they actually come across.
    </p>
    <p style="margin:0 0 20px;font-size:15px;font-weight:600;color:#0F1B2D;line-height:1.7;">
      Gravitas changes that.
    </p>
    <p style="margin:0 0 28px;font-size:15px;color:#4B5563;line-height:1.7;">
      After every session, you will receive a specific, evidence-based picture of how you show up — your structure, your voice quality, your vocal delivery, your physical presence — across 15 dimensions. With coaching feedback that tells you not just what is happening, but what to do about it.
    </p>
    <p style="margin:0 0 28px;font-size:15px;color:#4B5563;line-height:1.7;">
      Your first session takes a minute. No preparation needed — just speak as you would in a real professional moment.
    </p>`;

  const interviewSignoff = `Rooting for your success,`;
  const workplaceSignoff = `To showing up at your best,`;

  const body = interviewMode ? interviewBody : workplaceBody;
  const signoff = interviewMode ? interviewSignoff : workplaceSignoff;

  const { error } = await resend.emails.send({
    from: FROM_KANZA,
    replyTo: "kanza@selfcraftpartners.com",
    to,
    subject: "Welcome to Gravitas!",
    headers: {
      "X-Entity-Ref-ID": `welcome-${to.slice(0, 8)}`,
    },
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Welcome to Gravitas</title>
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
            ${body}
            <table cellpadding="0" cellspacing="0" style="margin:0 auto 32px;">
              <tr>
                <td style="background:linear-gradient(120deg,#F0953E 0%,#C84A18 100%);border-radius:8px;">
                  <a href="${appUrl}/record" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:0.2px;">
                    Record your first session →
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:0 0 4px;font-size:15px;color:#4B5563;line-height:1.7;">${signoff}</p>
            <p style="margin:0 0 4px;font-size:15px;font-weight:600;color:#0F1B2D;">Kanza Azeemi</p>
            <p style="margin:0 0 4px;font-size:14px;color:#4B5563;">Founder, Gravitas</p>
            <p style="margin:0 0 28px;font-size:14px;">
              <a href="https://www.linkedin.com/in/kanzaazeemi/" style="color:#0F1B2D;text-decoration:underline;">LinkedIn</a>
            </p>
            <p style="margin:0;font-size:14px;color:#6B7280;line-height:1.7;border-top:1px solid #F3F0EC;padding-top:20px;">
              <em>P.S. I read every reply to this email. If you have a question or a thought, just hit reply.</em>
            </p>
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
    logger.error({ err: error, to }, "Failed to send welcome email");
    throw new Error("Failed to send welcome email");
  }
  logger.info({ to }, "Welcome email sent");
}

export async function scheduleNudgeEmail(to: string, name: string, interviewMode: boolean): Promise<string | null> {
  const firstName = name.split(" ")[0];
  const appUrl = getAppUrl();
  const scheduledAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const interviewBody = `
    <p style="margin:0 0 20px;font-size:15px;color:#0F1B2D;line-height:1.7;">Hi ${firstName},</p>
    <p style="margin:0 0 28px;font-size:15px;color:#4B5563;line-height:1.7;">
      Your first session is a baseline. You will be asked one question — <em>"Tell me about yourself"</em> — and the only brief is to answer it as naturally as you would in the room. No rehearsal, no preparation needed.
    </p>`;

  const workplaceBody = `
    <p style="margin:0 0 20px;font-size:15px;color:#0F1B2D;line-height:1.7;">Hi ${firstName},</p>
    <p style="margin:0 0 28px;font-size:15px;color:#4B5563;line-height:1.7;">
      Your first session is a baseline. You will be asked to walk through a project you're currently working on — and the only brief is to speak as you naturally would when briefing a senior leader. No script, no preparation needed.
    </p>`;

  const body = interviewMode ? interviewBody : workplaceBody;

  const { data, error } = await resend.emails.send({
    from: FROM_KANZA,
    replyTo: "kanza@selfcraftpartners.com",
    to,
    subject: "Your first session is ready when you are",
    scheduledAt,
    headers: {
      "X-Entity-Ref-ID": `nudge-${to.slice(0, 8)}`,
    },
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your first session is ready</title>
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
            ${body}
            <table cellpadding="0" cellspacing="0" style="margin:0 auto 32px;">
              <tr>
                <td style="background:linear-gradient(120deg,#F0953E 0%,#C84A18 100%);border-radius:8px;">
                  <a href="${appUrl}/record" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:0.2px;">
                    Record your first session →
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:0 0 4px;font-size:15px;color:#4B5563;line-height:1.7;">Warmly,</p>
            <p style="margin:0;font-size:15px;font-weight:600;color:#0F1B2D;">Kanza Azeemi</p>
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

  if (error || !data?.id) {
    logger.error({ err: error, to }, "Failed to schedule nudge email");
    return null;
  }
  logger.info({ to, emailId: data.id }, "Nudge email scheduled for 24h");
  return data.id;
}

export async function cancelScheduledEmail(emailId: string): Promise<void> {
  try {
    await resend.emails.cancel(emailId);
    logger.info({ emailId }, "Scheduled email cancelled");
  } catch (err) {
    logger.error({ err, emailId }, "Failed to cancel scheduled email");
  }
}
