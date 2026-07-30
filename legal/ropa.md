# Record of Processing Activities (RoPA)
**Gravitas AI**
Version 1.0 — 25 June 2026
Maintained by: Kanza Azeemi (Data Controller)
Review date: 25 June 2027

Maintained pursuant to Article 30 GDPR.

---

## Controller Details

| Field | Details |
|---|---|
| Organisation name | Gravitas AI |
| Data controller | Kanza Azeemi |
| Contact email | info@selfcraftpartners.com |
| EU/UK establishment | [To be confirmed] |

---

## Processing Activity 1 — User Account Management

| Field | Details |
|---|---|
| **Purpose** | Creating and managing user accounts; authenticating users |
| **Legal basis** | Article 6(1)(b) — performance of contract |
| **Data subjects** | Registered users |
| **Personal data** | Name, email address, password (bcrypt hash), account creation date, email verification status |
| **Source of data** | Directly from the data subject at signup |
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
| **Security measures** | Stored in EU-hosted PostgreSQL (Supabase); access limited to authenticated user |
| **Automated decisions** | None |

---

## Processing Activity 3 — Voice Recording Processing and Transcription

| Field | Details |
|---|---|
| **Purpose** | Converting speech to text for coaching analysis |
| **Legal basis** | Article 6(1)(a) + Article 9(2)(a) — explicit consent (biometric data) |
| **Data subjects** | Users submitting audio practice sessions |
| **Personal data** | Audio recording of user's voice (biometric data) |
| **Source of data** | Directly from the data subject via browser microphone |
| **Recipients** | OpenAI (transcription via gpt-4o-mini-transcribe API) |
| **International transfers** | OpenAI (USA) — Standard Contractual Clauses; OpenAI may retain audio up to 30 days for abuse prevention |
| **Retention period** | Audio file: not stored — discarded immediately after transcription (seconds). Transcript: stored for lifetime of account |
| **Security measures** | Audio transmitted via TLS; processed in server memory only; never written to disk or database; OpenAI DPA in place |
| **Automated decisions** | Transcription is automated; no consequential decisions made solely on this basis |

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
| **Recipients** | Gravitas AI (internal only) |
| **International transfers** | None (stored in EU — Supabase, Frankfurt) |
| **Retention period** | Lifetime of account + 30 days after deletion request |
| **Security measures** | EU-hosted PostgreSQL; access restricted to authenticated user only; TLS in transit |
| **Automated decisions** | None |

---

## Processing Activity 7 — Transactional Email Communications

| Field | Details |
|---|---|
| **Purpose** | Sending account verification, password reset, deletion confirmation, and deletion warning emails |
| **Legal basis** | Article 6(1)(b) — performance of contract; Article 6(1)(c) — legal obligation (deletion notices) |
| **Data subjects** | All registered users |
| **Personal data** | Email address, first name, one-time tokens (included in email URLs) |
| **Source of data** | Directly from the data subject |
| **Recipients** | Resend (email delivery service) |
| **International transfers** | Resend (EU-compliant; GDPR DPA available) |
| **Retention period** | Email delivery logs retained by Resend per their own policy; Gravitas does not retain email logs beyond server logs (30-day rolling) |
| **Security measures** | Tokens are single-use, time-limited (24h for verification, 1h for password reset, 30 days for restore), and cryptographically random (32 bytes) |
| **Automated decisions** | None |

---

## Processing Activity 8 — Consent Records

| Field | Details |
|---|---|
| **Purpose** | Recording that users have accepted the Terms of Service and Privacy Policy, including consent for biometric data processing |
| **Legal basis** | Article 6(1)(c) — legal obligation |
| **Data subjects** | All registered users |
| **Personal data** | Consent timestamp, privacy policy version accepted |
| **Source of data** | Generated at point of signup or in-app consent |
| **Recipients** | Gravitas AI (internal only) |
| **International transfers** | None |
| **Retention period** | Lifetime of account + 30 days after deletion request |
| **Security measures** | Stored in EU-hosted PostgreSQL alongside user record |
| **Automated decisions** | None |

---

## Processing Activity 9 — Account Deletion and Data Purge

| Field | Details |
|---|---|
| **Purpose** | Honouring users' right to erasure; permanently deleting all personal data on account closure |
| **Legal basis** | Article 6(1)(c) — legal obligation; Article 17 GDPR |
| **Data subjects** | Users who have requested account deletion |
| **Personal data** | All categories listed above |
| **Process** | Account deactivated immediately; restore token issued (30-day window); 7-day warning email at day 23; permanent deletion at day 30 via automated database job |
| **Recipients** | Gravitas AI (internal); Resend (deletion confirmation and warning emails) |
| **Retention period** | Permanent deletion within 30 days of request |
| **Security measures** | Deletion is cascading (scores → sessions → user); automated via pg_cron; restore token is single-use and expires at day 30 |
| **Automated decisions** | None |

---

## Sub-processors

| Processor | Service | Location | Transfer basis | DPA |
|---|---|---|---|---|
| Supabase | Database hosting (PostgreSQL) | EU (Frankfurt) | EU adequacy | Supabase DPA (available in dashboard) |
| OpenAI | Speech-to-text transcription | USA | Standard Contractual Clauses | OpenAI DPA (signed via platform) |
| Anthropic | AI coaching analysis, vision | USA | Standard Contractual Clauses | Anthropic DPA (signed via account) |
| Resend | Transactional email | EU-compliant | EU adequacy / DPA | Resend DPA (available in dashboard) |

---

## Document History

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0 | 25 June 2026 | Kanza Azeemi | Initial version |
| 1.1 | 25 June 2026 | Kanza Azeemi | Added employer/organisation name to Processing Activity 2 (workplace onboarding) |

*This document must be updated whenever processing activities change — new data types, new processors, changed retention periods, or new purposes.*
