# Record of Processing Activities (RoPA)
**Gravitas AI**
Version 1.2 — 28 August 2026
Maintained by: Kanza Azeemi (Data Controller)
Review date: 25 June 2027

Maintained pursuant to Article 30 GDPR.

---

## Controller Details

| Field | Details |
|---|---|
| Organisation name | Gravitas AI (trading name; legal entity being incorporated in Ontario, Canada) |
| Data controller | Kanza Azeemi |
| Contact email | info@selfcraftpartners.com |
| EU/UK establishment | [To be confirmed — pending external legal advice] |

---

## Processing Activity 1 — User Account Management

| Field | Details |
|---|---|
| **Purpose** | Creating and managing user accounts; authenticating users |
| **Legal basis** | Article 6(1)(b) — performance of contract |
| **Data subjects** | Registered users |
| **Personal data** | Name, email address, password (bcrypt hash), account creation date, email verification status |
| **Source of data** | Directly from the data subject at signup, or via Google Sign-In (see Activity 10) |
| **Recipients** | Gravitas AI (internal); Resend (email delivery of verification/reset emails) |
| **International transfers** | Resend (EU-compliant) |
| **Retention period** | Duration of account + 30 days after deletion request |
| **Security measures** | TLS in transit; bcrypt password hashing; JWT authentication; rate-limited login |
| **Automated decisions** | None |

---

## Processing Activity 2 — User Onboarding and Professional Profile

| Field | Details |
|---|---|
| **Purpose** | Personalising coaching experience based on professional context |
| **Legal basis** | Article 6(1)(b) — performance of contract |
| **Data subjects** | Registered users who have completed onboarding |
| **Personal data** | Role title, career stage, industry, work experience, goals, communication context, interview details (company, role, timeline, date), work environment, employer/organisation name, self-assessment scores |
| **Source of data** | Directly from the data subject during onboarding |
| **Recipients** | Gravitas AI (internal); Anthropic (subset used as context in coaching prompts) |
| **International transfers** | Anthropic (USA) — Standard Contractual Clauses |
| **Retention period** | Duration of account + 30 days after deletion request |
| **Security measures** | Stored in EU-hosted PostgreSQL (Supabase); access limited to the authenticated user and, where necessary for support, logged admin access (see Activity 6) |
| **Automated decisions** | None |

---

## Processing Activity 3 — Voice Recording Processing, Transcription, and Delivery Analysis

| Field | Details |
|---|---|
| **Purpose** | Converting speech to text for coaching analysis, and analysing vocal delivery (tone, pacing, prosody) |
| **Legal basis** | Article 6(1)(a) + Article 9(2)(a) — explicit consent (biometric data) |
| **Data subjects** | Users submitting audio practice sessions |
| **Personal data** | Audio recording of user's voice (biometric data) |
| **Source of data** | Directly from the data subject via browser microphone |
| **Recipients** | OpenAI — for two distinct purposes: (a) transcription via `gpt-4o-mini-transcribe`, and (b) vocal delivery/prosody analysis via `gpt-audio-mini`. The same audio is sent to both. |
| **International transfers** | OpenAI (USA) — Standard Contractual Clauses; OpenAI may retain audio up to 30 days for abuse prevention |
| **Retention period** | Audio file: not stored — discarded immediately after processing. Transcript and delivery analysis: stored for lifetime of account |
| **Security measures** | Audio transmitted via TLS; processed in server memory only; never written to disk or database; OpenAI DPA in place |
| **Automated decisions** | Transcription and delivery scoring are automated; no consequential decisions made solely on this basis |

**Note (v1.2):** this activity was previously documented as covering transcription only. It has been corrected to reflect that the same audio is also sent to OpenAI for a second, separate purpose (delivery/prosody analysis). Both are now disclosed in the Privacy Policy.

---

## Processing Activity 4 — Video Frame Analysis

| Field | Details |
|---|---|
| **Purpose** | Analysing physical delivery (eye contact, posture, facial expression, gestures) for video sessions |
| **Legal basis** | Article 6(1)(a) + Article 9(2)(a) — explicit consent (biometric data) |
| **Data subjects** | Users submitting video practice sessions |
| **Personal data** | Still image frames extracted from video (biometric data — facial images) |
| **Source of data** | Directly from the data subject via browser camera |
| **Recipients** | Anthropic (Claude claude-sonnet-4-6 Vision API — up to 20 frames per session) |
| **International transfers** | Anthropic (USA) — Standard Contractual Clauses; Anthropic does not train on API data |
| **Retention period** | Frames: not stored — held in memory during processing only, discarded within seconds. No raw video is ever stored |
| **Security measures** | Frames transmitted via TLS; processed in server memory as base64; never written to disk or database |
| **Automated decisions** | Analysis is automated; outputs inform coaching feedback presented to the user |

---

## Processing Activity 5 — AI Coaching Analysis and Scoring

| Field | Details |
|---|---|
| **Purpose** | Generating personalised coaching scores and feedback across 15 communication dimensions |
| **Legal basis** | Article 6(1)(b) — performance of contract |
| **Data subjects** | All users who complete a practice session |
| **Personal data** | Transcript, professional context (role, goals, industry, career stage), audio delivery metrics, video presence analysis |
| **Source of data** | Derived from processing activities 2, 3, and 4 above |
| **Recipients** | Anthropic (Claude claude-sonnet-4-6 API for scoring and coaching generation) |
| **International transfers** | Anthropic (USA) — Standard Contractual Clauses |
| **Retention period** | Input data (transcript, context) used in real-time; outputs (scores, feedback text) stored for lifetime of account |
| **Security measures** | Data transmitted via TLS; Anthropic DPA in place; prompts do not include unnecessary PII |
| **Automated decisions** | Scoring is automated. Users are informed scores are AI-generated. Scores do not produce legal or similarly significant effects — they are developmental feedback only |

---

## Processing Activity 6 — Session History and Progress Tracking

| Field | Details |
|---|---|
| **Purpose** | Storing session results so users can track their communication progress over time |
| **Legal basis** | Article 6(1)(b) — performance of contract |
| **Data subjects** | All users who have completed at least one session |
| **Personal data** | Session metadata (date, duration, mode), transcript, composite score, dimension scores, coaching feedback text, behavioural metrics (speech rate, filler words, pause patterns, vocal characteristics, eye contact rate) |
| **Source of data** | Derived from processing activities 3, 4, and 5 |
| **Recipients** | Gravitas AI (internal only). Authorised staff (administrators) can access this data for support and moderation purposes; each such access is logged (admin ID, timestamp, and record viewed) |
| **International transfers** | None (stored in EU — Supabase, Frankfurt) |
| **Retention period** | Lifetime of account + 30 days after deletion request |
| **Security measures** | EU-hosted PostgreSQL; access restricted to the authenticated user and audit-logged admin access; TLS in transit |
| **Automated decisions** | None |

**Note (v1.2):** this activity was previously documented as accessible only to the authenticated user. That was inaccurate — Gravitas administrators can access this data through the internal admin dashboard for support purposes. Access is now audit-logged (see `routes/admin.ts`), and this entry has been corrected to reflect that accurately.

---

## Processing Activity 7 — Transactional and Account-Related Email Communications

| Field | Details |
|---|---|
| **Purpose** | Sending account verification, password reset, deletion confirmation, deletion warning, welcome, and first-session-reminder emails |
| **Legal basis** | Article 6(1)(b) — performance of contract; Article 6(1)(c) — legal obligation (deletion notices) |
| **Data subjects** | All registered users |
| **Personal data** | Email address, first name, one-time tokens (included in email URLs) |
| **Source of data** | Directly from the data subject |
| **Recipients** | Resend (email delivery service) |
| **International transfers** | Resend (EU-compliant; GDPR DPA available) |
| **Retention period** | Email delivery logs retained by Resend per their own policy; Gravitas does not retain email logs beyond server logs (30-day rolling) |
| **Security measures** | Tokens are single-use, time-limited (24h for verification, 1h for password reset, 30 days for restore), and cryptographically random (32 bytes) |
| **Automated decisions** | None |

**Note (v1.2):** this activity previously omitted the welcome email (sent after onboarding) and the scheduled first-session reminder email, both of which support onboarding into the contracted service rather than being marketing communications, and are covered by the same Article 6(1)(b) basis. The `notify_on_upgrade` preference (an opt-in flag for a user to be notified when they reach their recording quota) previously defaulted to `true` for all users rather than being set only when a user takes the explicit "Notify me" action. This has been corrected: the default is now `false`, and the flag is only ever set `true` by the user's own action.

---

## Processing Activity 8 — Consent Records

| Field | Details |
|---|---|
| **Purpose** | Recording that users have accepted the Terms of Service and Privacy Policy, including consent for biometric data processing |
| **Legal basis** | Article 6(1)(c) — legal obligation |
| **Data subjects** | All registered users |
| **Personal data** | Consent timestamp, Privacy Policy version accepted, Terms of Service version accepted |
| **Source of data** | Generated at point of signup or in-app consent |
| **Recipients** | Gravitas AI (internal only) |
| **International transfers** | None |
| **Retention period** | Lifetime of account + 30 days after deletion request |
| **Security measures** | Stored in EU-hosted PostgreSQL alongside user record |
| **Automated decisions** | None |

**Note (v1.2):** this activity now also tracks the accepted Terms of Service version separately from the Privacy Policy version (previously only the latter was tracked), so that a policy or Terms update correctly triggers re-consent from existing users rather than only from users who had never consented at all.

---

## Processing Activity 9 — Account Deletion and Data Purge

| Field | Details |
|---|---|
| **Purpose** | Honouring users' right to erasure; permanently deleting all personal data on account closure |
| **Legal basis** | Article 6(1)(c) — legal obligation; Article 17 GDPR |
| **Data subjects** | Users who have requested account deletion |
| **Personal data** | All categories listed above |
| **Process** | Account deactivated immediately; restore token issued (30-day window); reminder email sent at day 23; permanent deletion at day 30 via a scheduled purge job that runs hourly |
| **Recipients** | Gravitas AI (internal); Resend (deletion confirmation and warning emails) |
| **Retention period** | Permanent deletion from live systems within 30 days of request; may persist in database backups for a further period (see Data Security Addendum) |
| **Security measures** | Deletion is cascading at the database level (dimension scores, AI usage records, and diagnostic metrics → sessions → user); the purge job and warning email are implemented and running in production; restore token is single-use and expires at day 30 |
| **Automated decisions** | None |

**Note (v1.2):** this activity is now fully implemented and verified in production. It was previously documented but not built — account deletion only soft-deleted the record with no purge mechanism, and the day-23 warning email was never sent. Both are now live: `artifacts/api-server/src/lib/deletion-purge.ts` runs hourly, and the database foreign key from sessions to users now cascades on delete.

---

## Processing Activity 10 — Google Sign-In

| Field | Details |
|---|---|
| **Purpose** | Allowing users to sign up or log in using their Google account instead of a password |
| **Legal basis** | Article 6(1)(b) — performance of contract |
| **Data subjects** | Users who choose to sign in with Google |
| **Personal data** | Google-verified name and email address |
| **Source of data** | Google, following the user's own action to sign in with their Google account |
| **Recipients** | Google (identity verification only) |
| **International transfers** | Google (USA) — Google's standard contractual protections |
| **Retention period** | Same as Processing Activity 1 (account lifetime + 30 days) |
| **Security measures** | Google ID token verified server-side against Google's own token endpoint over TLS |
| **Automated decisions** | None |

**New in v1.2.** This activity existed in the product but was not previously documented in this RoPA, the DPIA, or the Privacy Policy. All three have now been updated.

---

## Processing Activity 11 — Internal AI Usage and Cost Telemetry

| Field | Details |
|---|---|
| **Purpose** | Internal tracking of AI provider usage and cost per session, for business operations (cost monitoring, capacity planning) |
| **Legal basis** | Article 6(1)(f) — legitimate interests (running and monitoring the cost of the service); the underlying processing that generates this data is separately justified under Activities 3–5 |
| **Data subjects** | All users who complete a practice session |
| **Personal data** | Which AI operation ran, which model was used, token counts, and cost, linked to a session (and therefore a user) by internal reference only |
| **Source of data** | Generated internally during processing activities 3, 4, and 5 |
| **Recipients** | Gravitas AI (internal, admin-only) |
| **International transfers** | None (stored in EU — Supabase, Frankfurt) |
| **Retention period** | Lifetime of account + 30 days after deletion request (cascades with the parent session) |
| **Security measures** | Stored in a table separate from user-facing session data, specifically so it cannot be returned by user-facing API endpoints; access restricted to administrators |
| **Automated decisions** | None |

**New in v1.2.** This table existed in the database but was not previously documented as a processing activity. **Controller decision, final:** this data is deliberately and permanently excluded from the user-facing data export (Article 15/20) and from any other user-facing surface. It consists of internal cost and model-selection metadata (API call counts, token usage, cost) about how Gravitas operates the service, not information about the data subject's own characteristics, behaviour, or the coaching outcome itself. The substantive personal data generated by the same underlying processing — transcript, scores, feedback — is fully included in the export via Activities 5 and 6. Access to this table remains admin-only.

---

## Sub-processors

| Processor | Service | Location | Transfer basis | DPA |
|---|---|---|---|---|
| Supabase | Database hosting (PostgreSQL) | EU (Frankfurt) | EU adequacy | Supabase DPA (available in dashboard) |
| OpenAI | Speech-to-text transcription and vocal delivery analysis | USA | Standard Contractual Clauses | OpenAI DPA (signed via platform) |
| Anthropic | AI coaching analysis, vision | USA | Standard Contractual Clauses | Anthropic DPA (signed via account) |
| Resend | Transactional and account-related email | EU-compliant | EU adequacy / DPA | Resend DPA (available in dashboard) |
| Google | Sign-in identity verification | USA | Google's standard contractual protections | **To confirm — obtain/verify Google's data processing terms** |
| Railway | Application hosting (runs the API server; audio/video pass through server memory here in transit) | **To confirm exact hosting region** | **To confirm transfer basis** | **To confirm — obtain Railway's DPA** |

---

## Data Security Addendum — Backups

Gravitas' database provider (Supabase) is currently on a plan with no automated backups; a copy of erased data therefore does not persist anywhere once removed from the live database via Processing Activity 9. Gravitas intends to move to a plan with daily backups retained for 7 days, for disaster-recovery purposes; once that change takes effect, an erased record may persist in a backup for up to 7 additional days before being permanently overwritten. The Privacy Policy has been updated to disclose this 7-day backup retention window ahead of the plan change, since it was written to reflect the intended near-term state; the RoPA reflects the current, actual state for accuracy. **Action item: confirm the plan upgrade has occurred and remove this discrepancy note once it has.**

---

## Document History

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0 | 25 June 2026 | Kanza Azeemi | Initial version |
| 1.1 | 25 June 2026 | Kanza Azeemi | Added employer/organisation name to Processing Activity 2 (workplace onboarding) |
| 1.2 | 28 August 2026 | Kanza Azeemi | Corrected Activity 3 (disclosed second OpenAI purpose), Activity 6 (disclosed and logged admin access), Activity 7 (disclosed welcome/nudge emails, fixed `notify_on_upgrade` default), Activity 8 (added Terms version tracking), Activity 9 (erasure mechanism now implemented and verified in production); added Activity 10 (Google Sign-In) and Activity 11 (AI usage telemetry); added Google and Railway to sub-processors; added Data Security Addendum on backups |

*This document must be updated whenever processing activities change — new data types, new processors, changed retention periods, or new purposes.*
