# Personal Data Breach Response Procedure
**Gravitas AI**
Version 1.0 — 28 August 2026
Owner: Kanza Azeemi (Data Controller)

This procedure exists to satisfy Articles 33 and 34 GDPR: notifying a supervisory authority within 72 hours of becoming aware of a breach (unless unlikely to result in a risk to individuals), and notifying affected individuals without undue delay where the breach is likely to result in a high risk to them.

---

## 1. What counts as a breach

Any of the following, whether accidental or deliberate:
- Unauthorised access to, or disclosure of, personal data (e.g. a database credential leak, an admin account compromise, a misdirected email containing personal data)
- Loss or destruction of personal data without a backup to recover it from
- Any incident affecting a sub-processor (Supabase, OpenAI, Anthropic, Resend, Google, Railway) that exposes Gravitas user data
- A security vulnerability that was exploited, or a credible report of one, affecting user data

## 2. Immediate steps (first 24 hours from discovery)

1. **Contain it.** Rotate any compromised credentials (`SESSION_SECRET`, `DATABASE_URL`, API keys) immediately. If a specific account is compromised, force-expire its sessions and reset its password.
2. **Record the facts as you learn them**, in a new dated entry appended to this file's Incident Log (§5): what happened, when it was discovered, what data was involved, how many users are affected, and what has been done so far. Do this contemporaneously — do not wait until the investigation is "done."
3. **Assess scope.** Which table(s)/processor(s) were involved? Does it include special category data (voice/video/biometric metrics) or just account metadata? Special category data breaches are treated as higher severity by default.

## 3. The 72-hour clock (Article 33)

The clock starts when Gravitas **becomes aware** of the breach, not when it happened.

- **If notification to a supervisory authority is required:** this depends on the outcome of the Gap 1 establishment determination (which authority is the lead authority). Until that is resolved, if a breach occurs, notify the UK ICO and the equivalent EU authority for any affected EU state as a protective default, and note in the filing that the lead authority has not yet been formally determined.
- **What to include:** nature of the breach, categories and approximate number of data subjects and records affected, likely consequences, and measures taken or proposed to address it and mitigate harm.
- **If you don't have all the facts within 72 hours:** notify with what you know and state that further information will follow — GDPR allows phased notification.

## 4. Notifying affected users (Article 34)

Required when the breach is likely to result in a **high risk** to individuals' rights and freedoms — for Gravitas, this includes any breach involving voice/video data, transcripts, or the interview/employer profile fields, given their sensitivity.

- Notify affected users directly (email, using Resend) in clear, plain language: what happened, what data was involved, what Gravitas has done, and what the user can do to protect themselves (e.g. change their password if credentials may be affected).
- Do not need to notify individually if: the data was encrypted/unintelligible to an attacker, or Gravitas has taken measures that mean the high risk is no longer likely to materialise, or individual notification would involve disproportionate effort (in which case a public communication may substitute, with supervisory authority agreement).

## 5. Incident Log

*No entries yet. Append a new dated section below for each incident, however minor. An empty log is a sign the procedure has never been tested, not proof nothing has happened — review this file at least annually even without an incident.*

---

## 6. Roles

Gravitas is currently a single-founder operation. Kanza Azeemi is responsible for all steps above. As the team grows, this section should name who owns containment, who owns regulatory notification, and who owns user communication, so a live incident doesn't stall on figuring out who does what.

## 7. Review

This procedure should be reviewed annually, after any real incident (to incorporate lessons learned), and whenever a new sub-processor is added or Gravitas' establishment/lead authority is determined.
