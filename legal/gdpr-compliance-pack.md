# Gravitas AI — GDPR Compliance Pack

**Prepared for:** External data protection consultant (compliance sign-off review)
**Prepared by:** Kanza Azeemi, Data Controller, Gravitas AI
**Date:** 28 August 2026
**Product:** Gravitas AI — AI-powered communication and executive presence coaching platform
**Production URL:** https://gravitas.selfcraftpartners.com
**Controller contact:** info@selfcraftpartners.com

---

## 0. How to use this document

This is a single consolidated pack containing everything a reviewer needs to assess Gravitas AI's GDPR position:

| Part | Contents |
|---|---|
| **Part A** | Controller details, product and processing overview |
| **Part B** | Technical architecture and verified data flows |
| **Part C** | Complete data inventory (actual database fields) |
| **Part D** | Record of Processing Activities (Art. 30) |
| **Part E** | Data Protection Impact Assessment (Art. 35) |
| **Part F** | Data subject rights — as implemented in code |
| **Part G** | Sub-processors and international transfers |
| **Part H** | Security measures |
| **Part I** | **Known gaps and open questions** — items where the published policy and the deployed code do not currently match, or where a controller decision is outstanding |
| **Part J** | Privacy Policy (full text, as published) |
| **Part K** | Terms of Service (full text, as published) |
| **Part L** | Consent capture screens (full text, as presented to users) |

**Important note for the reviewer:** Parts D and E were authored in June 2026. In preparing this pack, the underlying source code was re-examined against those documents. **Part I records every discrepancy found.** Parts D and E are reproduced substantially as originally written so the reviewer can see the stated position; Part I is the corrective overlay and should be read as authoritative where the two conflict. Please do not sign off Parts D/E without reference to Part I.

---

# PART A — Controller and Processing Overview

## A.1 Controller details

| Field | Details |
|---|---|
| Organisation name | Gravitas AI (trading under Selfcraft Partners) |
| Data controller | Kanza Azeemi |
| Contact email | info@selfcraftpartners.com |
| EU/UK establishment | **[TO BE CONFIRMED — see Part I, Gap 1]** |
| Lead supervisory authority | **[TO BE DETERMINED — see Part I, Gap 1]** |
| Art. 27 representative | **[NOT APPOINTED — see Part I, Gap 1]** |
| DPO appointed | No — see Part I, Gap 2 for the Art. 37 assessment question |
| Current stage | Beta / pilot, low user volume |

## A.2 What the product does

A user records a short spoken practice session (audio only, or audio + video) in their browser. The recording is uploaded to the Gravitas API server, which:

1. Transcribes the audio to text (OpenAI).
2. Computes signal-processing metrics from the audio waveform (speech rate, pauses, vocal frequency) — performed locally on the server, no third party.
3. For video sessions, sends a small number of extracted still frames for visual analysis (Anthropic Claude Vision).
4. Sends the transcript, delivery metrics, and the user's stated professional context to Anthropic Claude to generate scores across 15 communication dimensions plus written coaching feedback.
5. Stores the transcript, scores, metrics and feedback against the user's account so the user can track progress over time.
6. Discards the audio and video frames.

## A.3 Why a DPIA was required

Gravitas processes **voice recordings and facial images from which behavioural characteristics are derived**, on a systematic basis, as the core function of the product. This engages Art. 9 special category data (biometric data for the purpose of uniquely identifying a natural person is the strict Art. 9(1) trigger; Gravitas has taken the conservative position of treating all voice and facial processing as special category data regardless of whether unique identification is the purpose). A DPIA is therefore conducted under Art. 35.

**Reviewer question:** Gravitas would welcome your view on whether the Art. 9 classification is strictly correct here, given that the *purpose* of the processing is behavioural analysis rather than unique identification. Gravitas has deliberately taken the more cautious position (explicit consent under Art. 9(2)(a)) but would like this confirmed or corrected, as it affects the consent architecture.

## A.4 Categories of data subject

- Individual registered users (self-serve consumers) — current live population.
- Prospective B2B/enterprise deployment (organisational cohorts, e.g. business school students, corporate employees) — **not yet live.** See Part I, Gap 12: an enterprise deployment introduces a controller/processor relationship and employment-context consent issues not covered by this pack.

---

# PART B — Technical Architecture and Verified Data Flows

## B.1 Deployment topology

pnpm monorepo, three deployable artifacts:

| Artifact | Description | Personal data role |
|---|---|---|
| `artifacts/ep-app` | React/Vite user-facing web app | Captures recordings, displays results |
| `artifacts/admin` | React/Vite internal admin dashboard | Staff access to user and session data |
| `artifacts/api-server` | Express 5 / Node ESM backend API | All processing and storage decisions |

Shared libraries include `lib/db` (Drizzle ORM schemas), and thin wrappers around the Anthropic and OpenAI SDKs.

## B.2 Recording pipeline — verified behaviour

The following was confirmed by inspection of `artifacts/api-server/src/routes/sessions.ts` and `artifacts/api-server/src/app.ts`:

| Step | Behaviour | Verification |
|---|---|---|
| Upload | Recording arrives as a multipart upload | `multer` configured with `multer.memoryStorage()` — **the file is held in a process memory buffer and is never written to disk** |
| Body size cap | 10 MB JSON limit | `express.json({ limit: "10mb" })` |
| Audio handling | Buffer passed directly to transcription and to in-process signal analysis | `const audioBuffer: Buffer = req.file?.buffer` |
| Video frames | Extracted client-side, transmitted as base64, held in memory, sent to Anthropic Vision | No filesystem or object-storage write path exists in the codebase |
| Persistence | Only derived text and numeric data written to PostgreSQL | No column of any table stores audio or video binary data (see Part C) |
| Disposal | Buffers become garbage-collectable when the request handler returns | No explicit zeroing of memory (see Part I, Gap 9) |

**Conclusion:** the claim in the Privacy Policy and DPIA that *"we do not permanently store your audio files or video recordings"* is **substantiated by the code.** There is no storage path for raw media. This is the single most important factual claim in the pack and it holds.

## B.3 Data flow diagram (narrative)

```
[User browser]
   |  (1) HTTPS/TLS: audio blob + optional video frames (base64)
   v
[Gravitas API server — Express, in-memory only]
   |
   |--(2) HTTPS/TLS: audio buffer ------------------> [OpenAI API, USA]
   |        gpt-4o-mini-transcribe                     returns: transcript + word timings
   |
   |--(3) local, no third party --------------------> [in-process signal analysis]
   |        WAV/PCM decode                             returns: WPM, pause pattern, F0
   |
   |--(4) HTTPS/TLS: audio buffer ------------------> [OpenAI API, USA]
   |        gpt-audio-mini                             returns: prosody/delivery assessment
   |
   |--(5) HTTPS/TLS: up to 20 still frames ---------> [Anthropic API, USA]
   |        claude-sonnet-4-6 Vision                   returns: physical delivery analysis
   |
   |--(6) HTTPS/TLS: transcript + metrics ----------> [Anthropic API, USA]
   |        + user professional context                 returns: 15 dimension scores + feedback
   |        claude-sonnet-4-6
   |
   |--(7) audio buffer + frames dropped (no persistence)
   |
   v  (8) TLS
[PostgreSQL — Supabase, EU Frankfurt]
   stores: transcript, scores, metrics, feedback text, account + profile data
   |
   v  (9) TLS, JWT-authenticated
[User browser — results and progress history]

[Resend] <-- (10) email address + first name + one-time token: transactional email
[Google] <-- (11) Google ID token verification, if user signs in with Google
```

**Note on step 4:** the DPIA as originally written (Part E, §3.3) states *"Only audio is sent to OpenAI (not video)"* framed as a data-minimisation measure, but does not disclose that audio is sent to OpenAI **twice, for two distinct purposes** — transcription *and* prosody/delivery analysis (`gpt-audio-mini`). This is corrected in Part I, Gap 5.

**Note on step 11:** Google Sign-In is implemented (`POST /v1/auth/google`) and Google is **not disclosed** in the Privacy Policy, the RoPA, or the DPIA. See Part I, Gap 4.

---

# PART C — Complete Data Inventory

This inventory was generated from the actual Drizzle ORM schema definitions in `lib/db/src/schema/`, not from documentation. It is the authoritative list of what Gravitas stores.

## C.1 Table `users`

| Field | Type | Category |
|---|---|---|
`id` | uuid | Identifier
`email` | varchar(255), unique | Identity data
`name` | varchar(255) | Identity data
`password_hash` | varchar(255) | Credential (bcrypt)
`role_title` | varchar(255) | Professional profile
`communication_context` | varchar(100) | Professional profile
`goal` | text (free text) | Professional profile — **free-text field, may contain unanticipated personal or third-party data**
`onboarding_completed` | boolean | Account state
`methodology_version` | varchar(10) | Account state
`default_recording_context` | varchar(20) | Preference
`email_summaries` | boolean | Marketing/comms preference
`has_seen_welcome` | boolean | Account state
`total_recording_seconds` | integer | Usage metering
`recording_seconds_allowance` | integer (default 1800) | Usage entitlement
`notify_on_upgrade` | boolean (**default true**) | Marketing/comms preference — see Part I, Gap 7
`interview_mode` | boolean | Professional profile
`interview_sector` | varchar(50) | Professional profile
`interview_sector_custom` | varchar(255) | Professional profile (free text)
`interview_companies` | text | Professional profile — **names third-party employers**
`is_admin` | boolean | Access control
`email_verified` | boolean | Account state
`email_verification_token` | varchar(255) | Security token
`email_verification_expires_at` | timestamptz | Security token
`password_reset_token` | varchar(255) | Security token
`password_reset_expires_at` | timestamptz | Security token
`career_stage` | varchar(50) | Professional profile
`education_level` | varchar(100) | Professional profile
`work_experience_years` | varchar(50) | Professional profile
`primary_goal` | varchar(50) | Professional profile
`interview_role` | varchar(255) | Professional profile
`interview_role_custom` | varchar(255) | Professional profile (free text)
`interview_timeline` | varchar(100) | Professional profile
`interview_stage` | varchar(100) | Professional profile
`interview_date` | varchar(50) | Professional profile — **reveals a specific future life event**
`has_confirmed_interview` | boolean | Professional profile
`work_environment` | varchar(100) | Professional profile
`work_organisation` | varchar(500) | Professional profile — **identifies current employer**
`work_current_role` | varchar(255) | Professional profile
`work_current_role_custom` | varchar(255) | Professional profile (free text)
`high_stakes_contexts` | text | Professional profile (free text)
`self_assessment_thought_clarity` | integer | Self-reported assessment
`self_assessment_vocal_delivery` | integer | Self-reported assessment
`self_assessment_voice_quality` | integer | Self-reported assessment
`self_assessment_physical_delivery` | integer | Self-reported assessment
`consent_accepted_at` | timestamptz | Consent record
`privacy_policy_version` | varchar(20) | Consent record
`account_restore_token` | varchar(255) | Deletion/restore token
`nudge_email_id` | varchar(255) | Scheduled email reference (Resend)
`created_at` | timestamptz | Account metadata
`updated_at` | timestamptz | Account metadata
`deleted_at` | timestamptz | **Soft-delete marker — see Part I, Gap 3**

**Reviewer note:** the professional profile is materially richer than the Privacy Policy summary suggests. In particular the combination of `work_organisation`, `work_current_role`, `interview_companies`, `interview_date` and `interview_stage` means the database knows *that a named individual at a named employer is interviewing at a named competitor on a specific date.* That is commercially sensitive information about the data subject with real potential for harm if disclosed, and arguably a higher-risk profile than the biometric processing. The Privacy Policy describes this only as "interview details you provide during onboarding". See Part I, Gap 6.

## C.2 Table `sessions`

| Field | Type | Category |
|---|---|---|
`id` | uuid | Identifier
`user_id` | uuid, FK → users.id | Link. **NOTE: no `onDelete` rule — see Part I, Gap 3**
`mode` | varchar(10) — audio/video | Session metadata
`methodology_version` | varchar(10) | Session metadata
`prompt_text` | text | Session metadata (the exercise prompt given)
`prompt_type` | varchar(50) | Session metadata
`recording_context` | varchar(20) | Session metadata
`duration_seconds` | integer | Session metadata
`transcript` | text | **Verbatim transcript of the user's speech — highest-sensitivity stored field**
`composite_score` | decimal(4,2) | Derived assessment
`composite_tier` | varchar(15) | Derived assessment
`audio_quality_flag` | boolean | Quality diagnostic
`face_coverage_flag` | boolean | Quality diagnostic (video)
`audio_gap_events` | integer | Quality diagnostic
`face_lost_events` | integer | Quality diagnostic (video)
`video_downloaded` | boolean | Flag; **currently unused in server code**
`silence_events` | integer | Quality diagnostic
`overall_feedback` | text (JSON blob) | AI-generated coaching feedback
`processing_status` | varchar(20) | Pipeline state
`processing_error` | text | **May capture upstream API error payloads — see Part I, Gap 10**
`created_at` | timestamptz | Session metadata
`scored_at` | timestamptz | Session metadata

## C.3 Table `dimension_scores`

`id` (uuid) · `session_id` (uuid, FK → sessions.id, **ON DELETE CASCADE**) · `dimension_key` (varchar 50) · `score` (integer 1–10) · `tier` (varchar 15) · `raw_metrics` (jsonb — behavioural biometric measurements) · `strength_text` (text) · `gap_text` (text) · `next_step_text` (text)

`raw_metrics` holds the derived behavioural biometrics: speech rate, filler word counts, pause distribution, fundamental frequency (F0) statistics, eye contact rate.

## C.4 Table `session_ai_usage`

`id` · `session_id` (FK → sessions.id, **ON DELETE CASCADE**) · `ai_call` (transcription / audio_delivery / vision / scoring) · `model` · `input_tokens` · `output_tokens` · `cost_usd` · `created_at`

Internal cost telemetry, admin-only. Links AI spend to an individual session and therefore to an individual user. **Not disclosed in the RoPA.** See Part I, Gap 8.

## C.5 Tables defined but not currently in use

The following tables exist in the schema (and therefore in the production database) but no application code reads from or writes to them. They are dormant from earlier or planned features:

| Table | Intended contents | Status |
|---|---|---|
`conversations` | Coaching chat threads | Defined, **no code references** |
`messages` | Individual chat messages (FK → conversations, CASCADE) | Defined, **no code references** |
`diagnostic_metrics` | Per-session diagnostic detail (FK → sessions, CASCADE, unique) | Defined, **no code references** |

**Reviewer note:** these are not currently a processing activity, but they are a live schema surface. If a future release activates the chat feature, `messages` will contain free-form conversational personal data and will need to be added to the RoPA, the DPIA, the export endpoint, and the deletion routine before launch.

---

# PART D — Record of Processing Activities (Article 30)

*Original document: `legal/ropa.md`, Version 1.1, 25 June 2026. Reproduced below. Corrections in Part I.*

## D.1 Processing Activity 1 — User Account Management

| Field | Details |
|---|---|
| **Purpose** | Creating and managing user accounts; authenticating users |
| **Legal basis** | Art. 6(1)(b) — performance of contract |
| **Data subjects** | Registered users |
| **Personal data** | Name, email address, password (bcrypt hash), account creation date, email verification status |
| **Source** | Directly from the data subject at signup |
| **Recipients** | Gravitas AI (internal); Resend (verification/reset email delivery) |
| **International transfers** | Resend (EU-compliant) |
| **Retention** | Duration of account + 30 days after deletion request |
| **Security** | TLS in transit; bcrypt password hashing; JWT authentication; rate-limited login |
| **Automated decisions** | None |

## D.2 Processing Activity 2 — Onboarding and Professional Profile

| Field | Details |
|---|---|
| **Purpose** | Personalising coaching based on professional context |
| **Legal basis** | Art. 6(1)(b) — performance of contract |
| **Data subjects** | Registered users who have completed onboarding |
| **Personal data** | Role title, career stage, industry, work experience, goals, communication context, interview details (company, role, timeline, date), work environment, employer/organisation name, self-assessment scores |
| **Source** | Directly from the data subject during onboarding |
| **Recipients** | Gravitas AI (internal); Anthropic (subset used as coaching prompt context) |
| **International transfers** | Anthropic (USA) — Standard Contractual Clauses |
| **Retention** | Duration of account + 30 days after deletion request |
| **Security** | EU-hosted PostgreSQL (Supabase); access limited to the authenticated user |
| **Automated decisions** | None |

## D.3 Processing Activity 3 — Voice Recording Processing and Transcription

| Field | Details |
|---|---|
| **Purpose** | Converting speech to text for coaching analysis |
| **Legal basis** | Art. 6(1)(a) + Art. 9(2)(a) — explicit consent (biometric data) |
| **Data subjects** | Users submitting audio practice sessions |
| **Personal data** | Audio recording of the user's voice (biometric data) |
| **Source** | Directly from the data subject via browser microphone |
| **Recipients** | OpenAI (`gpt-4o-mini-transcribe`) |
| **International transfers** | OpenAI (USA) — SCCs; OpenAI may retain audio up to 30 days for abuse prevention |
| **Retention** | Audio: not stored — discarded immediately after transcription. Transcript: stored for lifetime of account |
| **Security** | TLS in transit; server memory only; never written to disk or database; OpenAI DPA in place |
| **Automated decisions** | Transcription is automated; no consequential decisions made solely on this basis |

## D.4 Processing Activity 4 — Video Frame Analysis

| Field | Details |
|---|---|
| **Purpose** | Analysing physical delivery (eye contact, posture, expression, gesture) |
| **Legal basis** | Art. 6(1)(a) + Art. 9(2)(a) — explicit consent (biometric data) |
| **Data subjects** | Users submitting video practice sessions |
| **Personal data** | Still image frames extracted from video (facial images — biometric data) |
| **Source** | Directly from the data subject via browser camera |
| **Recipients** | Anthropic (`claude-sonnet-4-6` Vision, up to 20 frames per session) |
| **International transfers** | Anthropic (USA) — SCCs; Anthropic does not train on API data |
| **Retention** | Frames: not stored — memory only, discarded within seconds. No raw video ever stored |
| **Security** | TLS in transit; held in memory as base64; never written to disk or database |
| **Automated decisions** | Analysis is automated; outputs inform coaching feedback presented to the user |

## D.5 Processing Activity 5 — AI Coaching Analysis and Scoring

| Field | Details |
|---|---|
| **Purpose** | Generating coaching scores and feedback across 15 communication dimensions |
| **Legal basis** | Art. 6(1)(b) — performance of contract |
| **Data subjects** | All users who complete a practice session |
| **Personal data** | Transcript, professional context, audio delivery metrics, video presence analysis |
| **Source** | Derived from activities 2, 3 and 4 |
| **Recipients** | Anthropic (`claude-sonnet-4-6`) |
| **International transfers** | Anthropic (USA) — SCCs |
| **Retention** | Inputs used in real time; outputs stored for lifetime of account |
| **Security** | TLS; Anthropic DPA in place; prompts exclude unnecessary PII |
| **Automated decisions** | Scoring is automated. Users are informed scores are AI-generated. Scores are developmental feedback only and do not produce legal or similarly significant effects |

## D.6 Processing Activity 6 — Session History and Progress Tracking

| Field | Details |
|---|---|
| **Purpose** | Storing session results so users can track progress over time |
| **Legal basis** | Art. 6(1)(b) — performance of contract |
| **Data subjects** | All users with at least one session |
| **Personal data** | Session metadata, transcript, composite score, dimension scores, coaching feedback, behavioural metrics (speech rate, filler words, pauses, vocal characteristics, eye contact rate) |
| **Source** | Derived from activities 3, 4 and 5 |
| **Recipients** | Gravitas AI (internal only) |
| **International transfers** | None (Supabase, Frankfurt) |
| **Retention** | Lifetime of account + 30 days after deletion request |
| **Security** | EU-hosted PostgreSQL; access restricted to the authenticated user; TLS |
| **Automated decisions** | None |

## D.7 Processing Activity 7 — Transactional Email

| Field | Details |
|---|---|
| **Purpose** | Account verification, password reset, deletion confirmation, deletion warning |
| **Legal basis** | Art. 6(1)(b) — contract; Art. 6(1)(c) — legal obligation (deletion notices) |
| **Data subjects** | All registered users |
| **Personal data** | Email address, first name, one-time tokens in email URLs |
| **Source** | Directly from the data subject |
| **Recipients** | Resend |
| **International transfers** | Resend (EU-compliant; GDPR DPA available) |
| **Retention** | Delivery logs retained by Resend per their policy; Gravitas retains no email logs beyond server logs (30-day rolling) |
| **Security** | Tokens single-use, time-limited (24h verification, 1h password reset, 30d restore), cryptographically random (32 bytes) |
| **Automated decisions** | None |

**Correction:** this activity is incomplete — Gravitas also sends welcome and engagement "nudge" emails. See Part I, Gap 7.

## D.8 Processing Activity 8 — Consent Records

| Field | Details |
|---|---|
| **Purpose** | Recording acceptance of the Terms and Privacy Policy, including biometric consent |
| **Legal basis** | Art. 6(1)(c) — legal obligation |
| **Data subjects** | All registered users |
| **Personal data** | Consent timestamp, privacy policy version accepted |
| **Source** | Generated at signup or via in-app consent gate |
| **Recipients** | Gravitas AI (internal only) |
| **International transfers** | None |
| **Retention** | Lifetime of account + 30 days after deletion request |
| **Security** | Stored in EU-hosted PostgreSQL alongside the user record |
| **Automated decisions** | None |

## D.9 Processing Activity 9 — Account Deletion and Data Purge

| Field | Details |
|---|---|
| **Purpose** | Honouring the right to erasure |
| **Legal basis** | Art. 6(1)(c) — legal obligation; Art. 17 |
| **Data subjects** | Users who have requested account deletion |
| **Personal data** | All categories above |
| **Process (as documented)** | Account deactivated immediately; restore token issued (30-day window); 7-day warning email at day 23; permanent deletion at day 30 via automated database job |
| **Recipients** | Gravitas AI (internal); Resend (confirmation and warning emails) |
| **Retention** | Permanent deletion within 30 days of request |
| **Security (as documented)** | Cascading deletion (scores → sessions → user); automated via `pg_cron`; single-use restore token expiring at day 30 |
| **Automated decisions** | None |

**⚠ MATERIAL CORRECTION:** the documented process is **not implemented.** Steps 3 and 4 (warning email, permanent deletion) do not exist in the codebase, and the described cascade would fail at the database level. This is the most significant finding in the pack. See **Part I, Gap 3** — please read before assessing this activity.

## D.10 Sub-processors (as documented)

| Processor | Service | Location | Transfer basis | DPA |
|---|---|---|---|---|
| Supabase | PostgreSQL hosting | EU (Frankfurt) | EU — no transfer | Supabase DPA (available in dashboard) |
| OpenAI | Speech-to-text | USA | SCCs | OpenAI DPA (signed via platform) |
| Anthropic | Coaching analysis, vision | USA | SCCs | Anthropic DPA (signed via account) |
| Resend | Transactional email | EU-compliant | EU adequacy / DPA | Resend DPA (available in dashboard) |

**Incomplete** — see Part G for the corrected list, which adds OpenAI audio-delivery analysis, Google, and the application hosting provider.

## D.11 RoPA document history

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0 | 25 June 2026 | Kanza Azeemi | Initial version |
| 1.1 | 25 June 2026 | Kanza Azeemi | Added employer/organisation name to Activity 2 |

---

# PART E — Data Protection Impact Assessment (Article 35)

*Original document: `legal/dpia.md`, Version 1.1, 25 June 2026. Reproduced below. Corrections in Part I.*

## E.1 Overview

Conducted pursuant to Art. 35. Required because Gravitas processes biometric data (voice recordings and video frames from which behavioural characteristics are derived) and special category data on a systematic basis.

**Data Controller:** Gravitas AI / Kanza Azeemi · **Contact:** info@selfcraftpartners.com
**Version 1.1 — 25 June 2026** · **Next review:** 25 June 2027

## E.2 Data categories and classification

| Data Category | Examples | GDPR Classification |
|---|---|---|
| Identity data | Name, email address | Personal data |
| Professional profile | Role, career stage, goals, industry, interview details, employer/organisation name | Personal data |
| Voice recordings | Audio of speech during practice sessions | Biometric (special category) |
| Video frames | Still images from video sessions for facial analysis | Biometric (special category) |
| Transcripts | Word-for-word text of speech | Personal data |
| Behavioural biometrics | Speech rate, filler frequency, pause patterns, F0, eye contact rate | Biometric (special category) |
| Coaching feedback | AI-generated scoring and commentary | Personal data |
| Consent records | Timestamp and version of policy accepted | Personal data |

## E.3 Purpose

The sole purpose is to provide personalised AI coaching feedback to the user on their communication style and executive presence. No data is used for advertising, profiling for third-party purposes, or resale.

## E.4 Legal basis

| Data type | Legal basis |
|---|---|
| Account data, transcripts, session history | Art. 6(1)(b) — performance of contract |
| Voice recordings, video frames, biometric metrics | Art. 6(1)(a) + Art. 9(2)(a) — explicit consent |
| Consent records | Art. 6(1)(c) — legal obligation |

**Reviewer question:** Gravitas relies on Art. 6(1)(b) for transcripts and session history, but on consent for the voice recording that produces them. Since the recording cannot be processed at all without consent, and the transcript is a direct derivative, please advise whether this split basis is coherent or whether the whole recording-to-feedback chain should rest on explicit consent. This bears directly on what must happen on withdrawal — see Part I, Gap 11.

## E.5 Access and recipients

| Recipient | Role | Location | Transfer mechanism |
|---|---|---|---|
| Gravitas AI (internal) | Data controller | N/A | N/A |
| Supabase | Database hosting | EU (Frankfurt) | EU adequacy / standard contract |
| OpenAI | Speech-to-text transcription | USA | SCCs |
| Anthropic | Coaching analysis, video frame analysis | USA | SCCs |
| Resend | Transactional email delivery | EU-compliant | DPA in place |

## E.6 Data flows (as documented)

1. User submits audio/video recording via the browser.
2. Audio is sent to OpenAI's API for transcription. Video frames are extracted in memory (not persisted).
3. Transcript, video frames, and professional context are sent to Anthropic's Claude API for coaching analysis.
4. Audio and video frames are discarded immediately after processing (never stored).
5. Transcript, scores, and coaching feedback are stored in Supabase (EU-hosted PostgreSQL).
6. User accesses their results via the Gravitas web application.

*See Part B.3 for the corrected and expanded flow.*

## E.7 Retention (as documented)

- Audio/video: never stored — deleted within seconds of processing
- Transcripts, scores, feedback: retained for the lifetime of the user's account
- Account data: retained until account deletion + 30-day grace period
- On account deletion: all data permanently erased within 30 days

## E.8 Necessity and proportionality

**Necessary?** Yes. The core function — personalised, data-driven feedback on communication effectiveness — cannot be achieved without analysing the user's actual voice and, for video sessions, their visual delivery. There is no less privacy-invasive way to deliver the same outcome.

**Proportionate?** Assessed as yes, because:
- Users provide explicit, informed consent before any recording is processed
- Audio and video are never stored — processed entirely in memory and discarded
- Derived metrics are stored only to provide the user with their own progress history
- Users can delete their data at any time, including individual sessions or their entire account
- Data is not used for any purpose beyond coaching the individual user

**Data minimisation measures:**
- Only audio is sent to OpenAI (not video)
- Only up to 20 video frames per session are sent to Claude (not the full video)
- Professional context sent to Anthropic is limited to what the user has voluntarily provided
- No raw audio or video is stored at rest

## E.9 Risk assessment

| Risk | Likelihood | Severity | Inherent | Mitigating Controls | Residual |
|---|---|---|---|---|---|
| Unauthorised access to transcripts/scores in database | Low | High | Medium | TLS in transit, Supabase RLS, strong authentication, JWT auth | Low |
| Voice data intercepted in transit to OpenAI | Very Low | High | Medium | TLS 1.3 on all API calls, no logging of audio content | Low |
| Video frames intercepted in transit to Anthropic | Very Low | High | Medium | TLS 1.3, frames not stored, ephemeral processing | Low |
| Data breach at third-party processor (OpenAI/Anthropic) | Low | High | Medium | DPAs with SCCs, processors do not train on API data, limited data sent | Low–Medium |
| Accidental exposure of biometric data via logs | Low | High | Medium | Pino logger redacts auth headers; audio/video never logged | Low |
| User loses access to their progress data | Low | Medium | Low | Soft delete with 30-day grace period, self-service export | Very Low |
| Consent not properly recorded | Very Low | High | Medium | Consent timestamp and policy version stored on every signup | Very Low |
| Data retained beyond intended period | Low | Medium | Low | Explicit user deletion flow; automated 30-day purge after deletion | Very Low |
| Children's data processed | Very Low | High | Medium | Minimum age 16 in Terms; signup requires explicit agreement | Very Low |

**Stated conclusion:** all risks reduced to Low or Very Low; no residual high risks; processing may proceed.

**⚠ CORRECTIONS to this risk table:**
- *"Supabase RLS"* — **no row-level security policies exist** anywhere in the codebase or migrations. Isolation is enforced solely in application code. See Part I, Gap 13.
- *"automated 30-day purge after deletion"* — **does not exist.** The residual risk for "data retained beyond intended period" should be **High**, not Very Low. See Part I, Gap 3.
- The table omits the risk of **internal staff access to transcripts** via the admin dashboard. See Part I, Gap 6.
- The table omits the risk arising from the **commercially sensitive interview/employer profile**, which is arguably higher-impact than the biometric risk. See Part I, Gap 6.

## E.10 Data subject rights (as documented)

| Right | Implementation |
|---|---|
| Access (Art. 15) | Self-service JSON export in Account Settings |
| Rectification (Art. 16) | Profile fields editable in Account Settings |
| Erasure (Art. 17) | Account deletion in Settings; all data purged within 30 days |
| Portability (Art. 20) | JSON export covering all personal data and session history |
| Withdraw consent (Art. 7(3)) | Delete account at any time; withdrawal does not affect prior lawful processing |
| Object (Art. 21) | Contact info@selfcraftpartners.com |
| Lodge complaint | Communicated in the Privacy Policy |

*See Part F for verified implementation status.*

## E.11 Consultation and sign-off

As a small business processing biometric data, Gravitas AI conducted this DPIA internally. No unresolved high risks were identified at the time of writing.

| Role | Name | Date |
|---|---|---|
| Data Controller | Kanza Azeemi | 25 June 2026 |

**Reviewer note:** the present engagement is the external consultation. Given Part I, Gap 3, Gravitas' position is that the DPIA's "no residual high risk" conclusion **cannot currently be sustained** and the DPIA will require reissue at version 2.0 following your review and the remediation of the gaps.

---

# PART F — Data Subject Rights: Verified Implementation Status

Each right below was traced to the actual endpoint or UI that delivers it.

| Right | Mechanism | Code location | Verified status |
|---|---|---|---|
| **Access (Art. 15)** | `GET /v1/users/me/export` — returns JSON attachment | `routes/users.ts` | ⚠ **Partial.** Returns `user` (minus password hash), `sessions`, `scores`. Omits `session_ai_usage`. Dormant tables not covered. No processing-information preamble (Art. 15(1)(a)–(h)) — recipients, retention, transfer safeguards are not included in the export payload |
| **Rectification (Art. 16)** | `PATCH /v1/users/me` + Account Settings UI | `routes/users.ts` | ✅ Works. Most profile fields editable. Note: `email` is **not** in the updatable field list — a user cannot correct their own email address |
| **Erasure (Art. 17)** | `DELETE /v1/users/me` | `routes/users.ts` | ❌ **Sets `deleted_at` and issues a restore token only. No erasure ever occurs.** See Part I, Gap 3 |
| **Portability (Art. 20)** | Same JSON export | `routes/users.ts` | ⚠ Structured, machine-readable JSON — format is adequate. Same completeness caveat as Access |
| **Withdraw consent (Art. 7(3))** | Account deletion | — | ⚠ **Consent withdrawal is only available bundled with total account deletion.** There is no way to withdraw biometric-processing consent while retaining an account, and no granular consent. See Part I, Gap 11 |
| **Object (Art. 21)** | Email to info@selfcraftpartners.com | — | ⚠ Manual. No logged process, no response-time tracking, no SAR register |
| **Restriction (Art. 18)** | — | — | ❌ **Not addressed** in the Privacy Policy, the DPIA, or the code |
| **Automated decision-making (Art. 22)** | Position: scores are developmental only | Terms §8 | ⚠ Defensible for the consumer product. **Requires re-assessment before any B2B deployment** where an employer or institution sees the scores — see Part I, Gap 12 |
| **Complaint to supervisory authority** | Stated in Privacy Policy §5 | — | ⚠ Right is stated but **no authority is named**, because the lead authority is undetermined (Gap 1) |
| **Breach notification (Art. 33/34)** | — | — | ❌ **No documented incident response or breach notification procedure exists.** See Part I, Gap 14 |

---

# PART G — Sub-processors and International Transfers (Corrected)

| # | Processor | Purpose | Data sent | Location | Transfer basis | DPA status | Disclosed in Privacy Policy? |
|---|---|---|---|---|---|---|---|
| 1 | **Supabase** | PostgreSQL hosting | All stored personal data | EU — Frankfurt | No transfer (EU) | DPA available in dashboard — **confirm executed** | ✅ Yes |
| 2 | **OpenAI** | Speech-to-text (`gpt-4o-mini-transcribe`) | Raw audio buffer | USA | SCCs | DPA via platform — **confirm executed** | ✅ Yes |
| 3 | **OpenAI** | Prosody / delivery analysis (`gpt-audio-mini`) | Raw audio buffer | USA | SCCs | As above | ❌ **No — undisclosed purpose** (Gap 5) |
| 4 | **Anthropic** | Vision analysis (`claude-sonnet-4-6`) | Up to 20 facial still frames | USA | SCCs | DPA via account — **confirm executed** | ✅ Yes |
| 5 | **Anthropic** | Scoring and coaching text (`claude-sonnet-4-6`) | Transcript, delivery metrics, professional context | USA | SCCs | As above | ✅ Yes |
| 6 | **Resend** | Transactional + engagement email | Email address, first name, one-time tokens | EU-compliant | EU adequacy / DPA | DPA available — **confirm executed** | ⚠ Partial — engagement email not disclosed (Gap 7) |
| 7 | **Google** | Google Sign-In ID token verification | Google ID token → email, name | USA | Google Cloud SCCs | **Not assessed** | ❌ **No — undisclosed processor** (Gap 4) |
| 8 | **Application hosting provider** | Runs the API server and serves the frontends | All data in transit; server logs | **[TO BE CONFIRMED]** | **[TO BE CONFIRMED]** | **Not assessed** | ❌ **No — undisclosed** (Gap 15) |

## G.1 Transfer risk assessment status

A **Transfer Impact Assessment (TIA)** has **not** been conducted for the US transfers (OpenAI, Anthropic, Google). Post-*Schrems II*, SCCs alone are not sufficient — a documented TIA is expected for each transfer, particularly where the data transferred is special category biometric data. Note that both OpenAI and Anthropic offer EU/UK data residency and zero-retention options on some plans; whether Gravitas is enrolled in these has **not been confirmed** and materially affects the assessment.

**Reviewer action requested:** please advise on (a) TIA requirements and scope for these three transfers, and (b) whether pursuing zero-retention / EU residency terms with OpenAI and Anthropic should be treated as a prerequisite for sign-off rather than an improvement.

## G.2 Specific transfer concerns

**OpenAI 30-day abuse-prevention retention.** The Privacy Policy discloses this. It means that for up to 30 days, raw biometric voice data of EU/UK data subjects sits at rest on US infrastructure outside Gravitas' control. This is the weakest point in the "we never store your audio" narrative: Gravitas does not store it, but a US processor does, temporarily. Gravitas considers the disclosure adequate but would welcome a view on whether it is sufficiently prominent, given it qualifies the product's headline privacy claim.

**Anthropic training.** Anthropic does not train on API data. This should be confirmed against the executed commercial terms rather than public documentation.

---

# PART H — Security Measures (Verified)

## H.1 Verified controls

| Control | Implementation | Location |
|---|---|---|
| Transport encryption | TLS on all external API calls and client connections | Platform + SDKs |
| Security headers | `helmet` with an explicit Content-Security-Policy: `default-src 'self'`, `frame-src 'none'`, no wildcard `connect-src` | `app.ts` |
| CORS | Allow-list from `ALLOWED_ORIGINS` env var; requests from non-listed origins rejected | `app.ts` |
| Password storage | bcrypt hash; `password_hash` stripped from every API response via destructuring | `routes/auth.ts`, `routes/users.ts` |
| Authentication | JWT, 7-day expiry, `requireAuth` middleware on all user routes | `lib/auth.ts` |
| Authorisation | Every user-scoped query filters on `req.user.userId`; `requireAdmin` middleware for admin routes | throughout |
| Rate limiting | `express-rate-limit` on auth endpoints (`authLimiter`) and password endpoints (`passwordLimiter`) | `routes/auth.ts` |
| Token hygiene | 32-byte `crypto.randomBytes` tokens; single-use; time-limited (24h verify, 1h reset, 30d restore) | `routes/auth.ts`, `routes/users.ts` |
| Log minimisation | `pino-http` request serialiser emits only request id, method, and **path with the query string stripped**; response serialiser emits only status code | `app.ts` |
| Log redaction | `authorization`, `cookie`, `set-cookie` headers redacted | `lib/logger.ts` |
| No media at rest | `multer.memoryStorage()` — no disk write path | `routes/sessions.ts` |
| Upload size cap | 10 MB | `app.ts` |
| Data residency | Primary datastore in EU (Frankfurt) | Supabase |
| Admin route hardening | Dedicated `requireAdmin` middleware; cost/usage data isolated in a separate table specifically so that user-facing `select()` queries cannot leak it | `routes/admin.ts`, `schema/sessionAiUsage.ts` |

The log minimisation and the deliberate table separation for `session_ai_usage` are both above-baseline choices and worth noting positively.

## H.2 Security observations

| Observation | Assessment |
|---|---|
| No row-level security in the database | Isolation is application-layer only — see Gap 13 |
| JWT stored in `localStorage` | XSS-readable. Mitigated by a restrictive CSP, but `script-src` includes `'unsafe-inline'`, which weakens that mitigation. `httpOnly` cookies would be stronger. Also makes the Privacy Policy cookie statement inaccurate — see Gap 16 |
| Global error handler returns `err.message` to the client | `res.status(500).json({ error: message })` may surface internal detail, including upstream provider error text, to the browser |
| No documented encryption-at-rest position | Supabase encrypts at rest by default; this is not recorded as a control anywhere in Gravitas' own documentation |
| No access logging for admin reads | Staff views of a user's transcript are not audit-logged — see Gap 6 |
| No documented backup/retention policy | Backups are a processing activity with their own retention; deletion of production data does not delete it from backups. Not addressed anywhere — see Gap 17 |
| No penetration test or external security assessment | None conducted |

---

# PART I — Known Gaps and Open Questions

This is the section requiring the reviewer's primary attention. Each gap states what the published documentation claims, what the code actually does, and the compliance consequence.

Severity: **P1** = blocks sign-off / active non-compliance · **P2** = should be fixed before sign-off · **P3** = should be addressed, not blocking

---

### 🔴 Gap 3 (listed first — most material) — The right to erasure is not implemented — **P1**

**✅ STATUS UPDATE — 28 August 2026: remediated.** The findings below describe the state at the time of the initial audit. Since then: `sessions.userId` now cascades on delete at the database level (verified against production); a scheduled purge job (`artifacts/api-server/src/lib/deletion-purge.ts`) runs hourly, sends the day-23 warning email via the previously-unused `sendDeletionWarningEmail()` function, and permanently deletes accounts 30+ days past their deletion request; and all admin routes (`routes/admin.ts`) now filter on `deleted_at IS NULL`, so soft-deleted users and their transcripts no longer appear in the internal dashboard. There were zero pending deletion requests at the time of the fix, so no backlog needed to be processed. See Gap 17 for the related backup-retention question, now also resolved. The findings that follow are retained as a record of what was found and fixed.

**What was published.** The Privacy Policy states: *"When you delete your account, it is immediately deactivated and all personal data — including your profile, session transcripts, scores, and performance metrics — is permanently and irreversibly erased within 30 days. You will receive a reminder email 7 days before the final deletion."* The RoPA (Activity 9) states deletion is *"automated via `pg_cron`"* with a *"7-day warning email at day 23"* and *"cascading (scores → sessions → user)"*.

**What the code did (before the fix).**

1. `DELETE /v1/users/me` sets `deleted_at = now()`, generates a restore token, and sends the deactivation email. That is the entire operation. It is a soft delete.
2. **There is no purge job.** A search of the entire repository for `pg_cron`, `cron`, `node-cron`, `setInterval`, and any hard-delete statement returns nothing. There are no scheduled jobs and only one SQL migration file, unrelated to deletion. No mechanism exists to ever delete the row.
3. **The day-23 warning email is never sent.** `sendDeletionWarningEmail()` is defined in `lib/email.ts:211` and is **never called from anywhere in the codebase.** The template exists; nothing invokes it.
4. **The documented cascade would fail if it were attempted.** `sessions.userId` references `users.id` with **no `onDelete` rule** (`schema/sessions.ts:17`). A `DELETE FROM users` would raise a foreign-key violation. `dimension_scores`, `session_ai_usage` and `diagnostic_metrics` do cascade from `sessions`, but `sessions` does not cascade from `users`. So even writing the cron job would not make the documented behaviour work without a schema migration or an explicit ordered delete.

**Consequence (at time of discovery).** Every Art. 17 erasure request received to date had gone unfulfilled while the user was told in writing that it was completed. Personal data including verbatim transcripts and biometric-derived metrics was retained indefinitely for every user who had ever asked to be deleted. Additionally, because admin queries did not filter on `deleted_at`, deleted users remained fully visible in the internal admin dashboard, including their transcripts.

This also meant the Privacy Policy contained a statement that was not true, which was an independent Art. 5(1)(a) transparency issue on top of the Art. 17 breach.

**Remediation applied.** (a) Added `onDelete: "cascade"` to `sessions.userId`, applied directly to the production schema; (b) implemented the scheduled purge job; (c) wired up the day-23 warning email; (d) filtered `deleted_at` in all admin queries; (e) addressed backups (see Gap 17); (f) confirmed there were no pending deletion requests to backfill.

**Reviewer note:** please confirm this remediation is adequate, and advise whether the historical gap (users told erasure completed when it had not) requires any retrospective step, given no user has actually been affected in practice (zero pending deletions existed).

**Reviewer question:** does the current position require notification to a supervisory authority, given users were affirmatively told erasure had occurred? Gravitas' user volume is small (beta) and can enumerate affected users precisely.

---

### 🔴 Gap 1 — Establishment, lead authority and Art. 27 representative undetermined — **P1**

The RoPA records EU/UK establishment as *"[To be confirmed]"*. Consequently: the lead supervisory authority is unidentified; the Privacy Policy tells users they may complain to *"your national data protection supervisory authority"* without naming Gravitas' own; and if Gravitas is established outside the EU/UK while offering services to data subjects within them, an **Art. 27 representative is required and has not been appointed.**

**Reviewer action requested:** this is a threshold question — most of the rest of the analysis (which regime applies, which authority, whether Art. 27 bites, governing law in the Terms) depends on it. Gravitas needs a determination here before anything else can be finalised.

---

### 🔴 Gap 11 — Consent architecture: bundled, non-granular, and not withdrawable without deletion — **P1**

Gravitas relies on Art. 9(2)(a) explicit consent for biometric processing. Three structural problems:

1. **Bundled.** A single checkbox covers the Terms of Service, the Privacy Policy, *and* explicit biometric consent. Art. 7(2) requires consent requests to be clearly distinguishable from other matters; explicit Art. 9 consent bundled with contractual acceptance is vulnerable to challenge.
2. **Not granular.** Audio processing and video/facial processing are covered by one consent, despite being distinguishable and separately avoidable — a user who wants audio-only coaching cannot consent to audio while refusing facial analysis, even though the product supports audio-only sessions.
3. **Not withdrawable independently.** The only stated withdrawal route is account deletion. Art. 7(3) requires withdrawal to be as easy as giving consent; requiring destruction of the account and all progress history is a meaningful detriment and arguably makes the consent non-free.

There is also a **legal-basis coherence** question flagged at Part E.4: recordings rest on consent, but the transcripts derived from them rest on contract. On withdrawal, what happens to the derived transcripts? The current answer ("everything is deleted, because withdrawal means account deletion") only works because withdrawal is bundled with deletion — which is itself the problem.

**Reviewer action requested:** please advise on the required consent architecture. Gravitas' expectation is that this needs separate audio and video consents, decoupled from Terms acceptance, individually withdrawable in Settings, with a defined consequence for derived data on withdrawal.

---

### 🟠 Gap 4 — Google is an undisclosed processor — **P2**

`POST /v1/auth/google` verifies Google ID tokens against `oauth2.googleapis.com/tokeninfo`, and `accounts.google.com` is allow-listed in the CSP `script-src`. Google Sign-In is live. Google appears **nowhere** in the Privacy Policy, RoPA, or DPIA. Users signing in with Google have a data flow to Google (USA) that has never been disclosed or transfer-assessed.

---

### 🟠 Gap 5 — Second OpenAI processing purpose undisclosed — **P2**

Audio is sent to OpenAI **twice**: once to `gpt-4o-mini-transcribe` for transcription (disclosed), and once to `gpt-audio-mini` for prosody and delivery analysis (**not disclosed**). The Privacy Policy tells users their audio goes to OpenAI "for speech-to-text transcription" — narrower than what actually happens. The DPIA's minimisation claim *"Only audio is sent to OpenAI"* is technically accurate but frames a single transcription call where there are two calls for two purposes.

---

### 🟠 Gap 6 — Internal staff access to transcripts is undisclosed and unlogged — **P2**

`routes/admin.ts` gives any user with `is_admin = true`: a list of all users with email addresses; per-user detail; and `GET /v1/admin/users/:id` / `GET /v1/admin/sessions/:id` which execute bare `select()` on `sessionsTable` — **returning all columns, including the full verbatim `transcript`.**

- The Privacy Policy tells users their session data is accessible to them and states processing is *"limited to the authenticated user"* (RoPA Activities 2 and 6 say access is *"limited to the authenticated user"* / *"restricted to the authenticated user only"*). **This is not accurate** — Gravitas staff can read any transcript.
- These reads are **not audit-logged.**
- The DPIA risk table has **no entry for internal/insider access.**
- Combined with Gap 3, admin views include soft-deleted users.

**Related, and worth the reviewer's specific attention:** as set out in Part C.1, the profile data enables the inference *"named person at named employer is interviewing at named company on a specific date."* Disclosure of that to the user's current employer could cost them their job. Gravitas' assessment is that this is a **higher-impact risk than the biometric processing** that triggered the DPIA, and it is currently unassessed in the DPIA and under-described in the Privacy Policy ("interview details you provide during onboarding"). Please advise on whether this warrants explicit treatment as a distinct high-risk processing activity.

---

### 🟠 Gap 7 — Engagement email not covered by the stated legal basis — **P2**

RoPA Activity 7 covers only verification, reset, and deletion emails. The code also sends:

- `sendWelcomeEmail()` — on onboarding completion
- `scheduleNudgeEmail()` — a scheduled engagement email ("Your first session is ready when you are"), stored as `nudge_email_id`
- `notifyAdminNewAccount()` / `notifyAdminSessionScored()` — internal notifications containing user name, email, and score, sent to Gravitas staff via Resend

The nudge email is engagement/marketing in character and is not covered by Activity 7's contract-performance basis. The `notify_on_upgrade` field **defaults to `true`** (opt-out, not opt-in), and `email_summaries` exists as a further comms flag. PECR/ePrivacy soft opt-in analysis has not been done.

**Reviewer action requested:** please confirm the correct basis for the nudge and upgrade-notification emails, and whether `notify_on_upgrade` defaulting to true is acceptable.

---

### 🟠 Gap 13 — "Supabase RLS" is claimed as a control but does not exist — **P2**

The DPIA risk table lists *"Supabase RLS"* as a mitigating control against unauthorised database access. A repository-wide search for row-level security policies, `RLS`, or any `CREATE POLICY` statement returns **nothing**. There is one SQL migration file and it is unrelated. Tenant isolation is enforced **entirely in application code** (every query filtering on `req.user.userId`). That application-layer filtering is applied consistently, so the practical risk is moderate rather than severe — but the stated control is not real and the DPIA must be corrected.

---

### 🟠 Gap 14 — No incident response or breach notification procedure — **P2**

No documented process exists for detecting, assessing, escalating, or notifying a personal data breach. Art. 33 requires notification to the supervisory authority within 72 hours; Art. 34 may require notification to data subjects. Given the special category data involved, a written procedure is expected. There is also no breach register.

---

### 🟠 Gap 15 — Application hosting provider unidentified and unassessed — **P2**

The API server was historically hosted on Replit. The current production hosting provider for `gravitas.selfcraftpartners.com` is not recorded in the RoPA or Privacy Policy. This processor handles all personal data in transit, holds server logs, and — critically for the "audio is never stored" claim — is the environment in which audio buffers exist in memory. It must be identified, DPA'd, and transfer-assessed. Its jurisdiction may also bear on Gap 1.

---

### 🟠 Gap 17 — Backup retention not addressed — **P2**

**✅ STATUS UPDATE — 28 August 2026: resolved, with one timing caveat the reviewer should note.**

**What was found.** Supabase takes automated backups on some plans. No documentation addressed backup retention periods, or the fact that erasing a row from production does not erase it from backups. Once Gap 3 was remediated, the erasure claim would still have been incomplete unless the backup position was defined and disclosed.

**What was confirmed.** Gravitas' Supabase project is currently on the **Free plan, which Supabase's own dashboard confirms takes no project backups at all.** As a result, at the moment the purge job deletes a row from the live database, no copy of that data exists anywhere — the "permanently and irreversibly erased" claim in the Privacy Policy is, right now, literally and completely true, with no backup tail to disclose.

**Planned change — please read the timing carefully.** Gravitas intends to upgrade to the **Pro plan, which provides daily backups retained for 7 days**, in order to have disaster-recovery protection (the Free plan's lack of any backup is itself an operational risk, independent of GDPR — see the note below). **The Privacy Policy has already been updated (v1.1, 28 August 2026) to disclose the 7-day backup retention window**, ahead of the actual upgrade, on the client's instruction. This means there is currently a short window in which the published policy describes a backup regime (7-day retention) that is not yet active — the account is still on Free with zero backups. This is the reverse of a typical transparency problem (the policy currently *overstates* how long data might persist, not understates it), and poses no risk to any data subject, but the reviewer should be aware the policy text and the live infrastructure are not yet in sync, and treat the Pro upgrade as an outstanding action item to close that gap. **Action required: confirm the Pro plan upgrade has been completed before relying on this section as fully accurate.**

**Related, non-GDPR observation.** The Free plan's total absence of backups is a business-continuity risk independent of data protection: there is currently no recovery path if the production database is lost or corrupted. This does not bear on the DPIA/RoPA sign-off, but is noted here because it directly motivated the decision to disclose Pro-plan backup terms ahead of the actual upgrade.

---

### 🟡 Gap 2 — DPO requirement not formally assessed — **P3**

No DPO is appointed. Art. 37(1)(c) requires one where there is large-scale processing of special category data. Gravitas processes special category data as its core activity but at very low volume in beta. The "large scale" threshold assessment has not been documented. **Reviewer view requested**, including at what user volume this changes — this is a scaling trigger Gravitas needs to know in advance.

---

### 🟡 Gap 8 — `session_ai_usage` not in the RoPA or the data export — **P3**

Internal AI cost telemetry linked to individual sessions and therefore to individual users. Not documented as a processing activity and not included in the Art. 15/20 export. Low sensitivity, but it is personal data by linkage and should be recorded.

---

### 🟡 Gap 9 — Memory disposal of biometric buffers is implicit — **P3**

Audio buffers and base64 frames are dropped when the request handler returns and are then garbage-collectable. There is no explicit zeroing. The DPIA's phrasing (*"deleted within seconds"*, *"discarded immediately"*) is stronger than "becomes eligible for garbage collection". Practically low-risk; the documentation wording should be made accurate.

---

### 🟡 Gap 10 — Free-text and error fields may capture unanticipated data — **P3**

- `sessions.processing_error` (text) may capture upstream provider error payloads, which can echo request content.
- The global error handler returns `err.message` to the client.
- `users.goal`, `high_stakes_contexts`, `interview_companies`, and the various `*_custom` fields are unconstrained free text into which users may enter data neither anticipated nor covered by the DPIA — including special category data (health, religion) and third-party personal data.
- The Terms tell users not to submit third-party or confidential information (§5), but nothing enforces or filters this, and transcripts of spontaneous speech are especially likely to contain third-party names and workplace detail.

---

### 🟡 Gap 12 — Planned B2B deployment is out of scope of all current documentation — **P3 now, P1 before launch**

Gravitas is developing enterprise features for organisational clients (business school and corporate pilots under discussion). This changes the analysis fundamentally and **none of it is covered by this pack**:

- Gravitas likely becomes a **processor** (or joint controller) for the client organisation, requiring Art. 28 DPAs *as processor* — a document Gravitas does not currently have.
- **Art. 22 re-opens.** Scores that are developmental feedback to an individual may become consequential where an employer or institution can see them (assessment, progression, hiring). The current Terms §8 position will not hold.
- **Consent cannot be freely given in an employment context.** Explicit biometric consent from employees instructed by their employer to use the platform is presumptively invalid; an alternative Art. 9 condition would be needed.
- If an organisational dashboard exposes individual or small-cohort scores to the client, that is a new disclosure requiring its own DPIA.

**Reviewer action requested:** please flag what must be in place before any enterprise pilot processes real user data. Gravitas would rather know the requirements now than retrofit them.

---

### 🟡 Gap 16 — Privacy Policy cookie statement is factually incorrect — **P3**

Privacy Policy §7 states Gravitas *"uses only essential functional cookies required to keep you logged in."* In fact **Gravitas sets no cookies at all** — the JWT is held in `localStorage` (`artifacts/ep-app/src/lib/api.ts`), and no `res.cookie()` call exists in the API server. `cookie-parser` is registered but unused for authentication.

The substance of the section (no advertising, analytics, or tracking) is accurate and the no-banner conclusion is unaffected — but the statement of fact is wrong and should be corrected to describe `localStorage`. Note that PECR/ePrivacy Art. 5(3) applies to *any* storage on terminal equipment, not just cookies, so the correct framing is "strictly necessary local storage".

---

### 🟡 Gap 18 — Document version control and policy-change consent are broken — **P3, now live rather than theoretical**

- `CURRENT_PRIVACY_POLICY_VERSION` was hardcoded as `"1.0"` in **two** places (`routes/auth.ts` and `routes/users.ts`) rather than in a shared constant. Both have now been bumped to `"1.1"` alongside the Privacy Policy update described in Gap 17, so new consent records correctly reference the current version — but this is a manual, error-prone fix, not a structural one.
- The Terms were updated **30 July 2026**; the Privacy Policy is now **v1.1, 28 August 2026** (previously v1.0, 25 June 2026) — so a user's consent record can, in principle, now distinguish which Privacy Policy version they accepted. It still cannot distinguish which Terms version, since Terms carry no version number at all.
- **Critically, `auth-context.tsx` computes `needsConsent = user.consentAcceptedAt === null`.** The re-consent gate therefore only ever fires for users who have never consented — never on a policy version change. **This is no longer a hypothetical:** the Privacy Policy was just bumped from v1.0 to v1.1 to disclose the new backup-retention terms (Gap 17), and by this same bug, **every existing user who already consented under v1.0 will never see that change, will never be asked to accept v1.1, and their consent record will remain silently marked as v1.0 forever** even though the version constant now issues "1.1" to new signups. The ConsentGate's own heading — *"We've updated our Terms & Privacy Policy"* — describes exactly this situation and cannot fire for it.
- The DPIA and RoPA both carry a header of "Version 1.0" with a document history recording changes up to 1.1, and have not yet been updated to reference the Privacy Policy's new v1.1.

**Remediation:** compare the stored `privacy_policy_version` against the current version rather than checking for null, and centralise the version constant. **Given the fix above just created a live instance of this bug** (existing users now silently out of date on a real policy change), Gravitas would like the reviewer's view on whether this should be reprioritised to P2 and fixed before the next policy revision, rather than left as a documented backlog item.

---

### 🟡 Gap 19 — Miscellaneous — **P3**

- **No Art. 30 processor-side records, SAR register, or consent-withdrawal log.** Rights requests arriving by email have no tracked workflow or response-time monitoring against the one-month Art. 12(3) deadline.
- **Art. 18 (restriction) is entirely unaddressed** in policy and code.
- **Email is not user-correctable** (Art. 16) — `email` is absent from the `PATCH /v1/users/me` field list.
- **Terms §13 governing law is a placeholder** — *"governed by ... applicable law"* and *"the appropriate courts"* name no jurisdiction, and so is likely unenforceable. Depends on Gap 1.
- **Age assurance is self-declaration only.** Terms §3 sets a 16 minimum with no verification. Note the UK/EU divergence on the age of digital consent (13–16 depending on member state) — the flat 16 is conservative and probably fine, but worth confirming.
- **No staff data protection training or confidentiality undertakings** are documented, despite staff transcript access (Gap 6).
- **No retention schedule for server logs.** The RoPA asserts a "30-day rolling" server log retention; no configuration implementing this was found.

---

## I.1 Summary table

| # | Gap | Severity |
|---|---|---|
| 3 | **Right to erasure — now implemented** (fixed 28 Aug 2026) | ✅ Resolved |
| 1 | Establishment / lead authority / Art. 27 representative undetermined | 🔴 P1 |
| 11 | Consent bundled, non-granular, not independently withdrawable | 🔴 P1 |
| 4 | Google an undisclosed processor | 🟠 P2 |
| 5 | Second OpenAI processing purpose undisclosed | 🟠 P2 |
| 6 | Staff transcript access undisclosed and unlogged; sensitive interview profile unassessed | 🟠 P2 |
| 7 | Engagement email outside stated legal basis; opt-out defaults | 🟠 P2 |
| 13 | "Supabase RLS" claimed as a control but does not exist | 🟠 P2 |
| 14 | No incident response / breach notification procedure | 🟠 P2 |
| 15 | Hosting provider unidentified and unassessed | 🟠 P2 |
| 17 | Backup retention — resolved (Free plan: no backups; Pro upgrade pending, policy updated ahead of it) | ✅ Resolved (see note) |
| 2 | DPO requirement not formally assessed | 🟡 P3 |
| 8 | `session_ai_usage` not in RoPA or export | 🟡 P3 |
| 9 | Memory disposal of biometric buffers implicit, not explicit | 🟡 P3 |
| 10 | Free-text and error fields may capture unanticipated data | 🟡 P3 |
| 12 | B2B deployment wholly out of scope of current documentation | 🟡 P3 → P1 pre-launch |
| 16 | Privacy Policy cookie statement factually incorrect | 🟡 P3 |
| 18 | Version control broken; re-consent gate can never fire | 🟡 P3 |
| 19 | Miscellaneous (Art. 18, SAR register, governing law, training, log retention) | 🟡 P3 |

## I.2 What Gravitas believes is solid

For balance, the following were tested and hold up:

- **Audio and video are genuinely never persisted.** There is no storage path in the codebase. The product's central privacy claim is true.
- **A DPIA was conducted before processing began**, and correctly identified biometric data as the trigger.
- **Tenant isolation is applied consistently** in application code — every user-scoped query filters on the authenticated user id.
- **Log hygiene is above baseline** — query strings stripped from request logs, auth headers redacted, no media content logged.
- **The primary datastore is in the EU**, so the bulk of stored personal data does not leave.
- **`session_ai_usage` was deliberately given its own table** specifically to prevent internal cost data leaking through user-facing `select()` queries — evidence of considered data-flow design.
- **Consent is captured and recorded** with a timestamp and version at signup, and is enforced by a blocking gate for pre-existing users.
- **Security fundamentals are present**: bcrypt, JWT, rate limiting on auth, helmet with a real CSP, an origin allow-list, cryptographically random single-use time-limited tokens.

## I.3 Questions on which Gravitas specifically requests the consultant's view

1. **Gap 1** — establishment, lead authority, Art. 27. Threshold question; everything else follows from it.
2. **Part A.3 / E.4** — is the Art. 9 classification strictly correct, and is the split legal basis (consent for recordings, contract for derived transcripts) coherent?
3. **Gap 3** — does the erasure failure require supervisory authority notification, given users were told in writing that erasure had completed?
4. **Gap 11** — required consent architecture: how granular, and what must happen to derived data on withdrawal?
5. **Gap 6** — should the interview/employer profile be treated as a distinct high-risk processing activity in its own right?
6. **Part G.1** — TIA scope for the three US transfers; should EU-residency / zero-retention terms with OpenAI and Anthropic be a precondition of sign-off?
7. **Gap 2** — at what scale does the DPO obligation bite?
8. **Gap 7** — correct basis for engagement email; is `notify_on_upgrade` defaulting to true acceptable?
9. **Gap 12** — what must be in place before an enterprise pilot processes real data?
10. **Overall** — which gaps must be closed *before* sign-off, and which can be accepted as a documented remediation plan with deadlines?

---

# PART J — Privacy Policy (Full Published Text)

*Source: `artifacts/ep-app/src/pages/privacy.tsx`, served at `/privacy`. Version 1.1, last updated 28 August 2026. Reproduced verbatim. Changes from v1.0: Section 4 now discloses Supabase backup retention; the Section 5 erasure right cross-references it. See Gap 17 for the important timing caveat — this section describes the Pro-plan 7-day backup terms, disclosed ahead of the actual plan upgrade, which is still pending as of this writing.*

## 1. Who we are

Gravitas AI ("Gravitas", "we", "us", "our") is the data controller for personal data processed through this platform. If you have any questions about how we handle your data, please contact us at info@selfcraftpartners.com.

## 2. What data we collect and why

**Account information.** Your name, email address, and password (stored as a secure hash). We need this to create and manage your account. Legal basis: contract performance (Article 6(1)(b) GDPR).

**Professional profile.** Career stage, work experience, role title, goals, industry, and interview details you provide during onboarding. We use this to personalise your coaching experience. Legal basis: contract performance and your consent.

**Voice and video recordings.** When you submit a practice session, we process your audio recording and (for video sessions) video frames. These are used solely to analyse your communication and provide coaching feedback. **We do not permanently store your audio files or video recordings.** They are processed in memory and immediately discarded after analysis. Legal basis: your explicit consent (Article 6(1)(a) and Article 9(2)(a) GDPR for biometric data).

**Transcripts and session feedback.** A text transcript of your speech and the AI-generated coaching feedback from each session are stored in our database. These are linked to your account and enable you to review your progress over time. Legal basis: contract performance.

**Performance metrics.** Quantitative data derived from your sessions — such as speech rate, filler word frequency, pausing patterns, vocal characteristics, and eye contact rate. These are stored as part of your session record. Legal basis: contract performance.

**Consent record.** The timestamp and version of this Privacy Policy you accepted when creating your account. We store this to demonstrate your consent. Legal basis: legal obligation (Article 6(1)(c) GDPR).

## 3. Who we share your data with

We share limited data with the following third-party service providers in order to deliver the Gravitas service. Each is bound by data processing agreements.

**OpenAI (United States).** Your audio recording is sent to OpenAI's API for speech-to-text transcription. Your voice is biometric data under GDPR. OpenAI may retain audio for up to 30 days for abuse prevention purposes in accordance with their data retention policy. We rely on Standard Contractual Clauses (SCCs) for this international data transfer.

**Anthropic (United States).** Your session transcript, coaching context (role, goals, industry), and video frames (for video sessions) are sent to Anthropic's Claude API for AI-powered coaching analysis and scoring. Anthropic does not train on API data by default. We rely on Standard Contractual Clauses (SCCs) for this international data transfer.

**Resend (email delivery).** Your email address and name are shared with Resend to deliver transactional emails (account verification, password reset). Resend is GDPR-compliant and does not use your data for marketing.

**Supabase (database hosting, EU).** Your data is stored on PostgreSQL databases hosted by Supabase in the EU (Frankfurt, Germany). Supabase is GDPR-compliant and your data remains within the EU.

We do not sell your data to any third party. We do not use your data for advertising.

## 4. How long we keep your data

**Active accounts:** We keep your account data and session history for as long as your account is active. Tracking your progress over time is a core purpose of the service, so we retain your session history to show you long-term improvement. You can delete individual sessions or all data at any time from your account settings.

**Audio and video:** Not stored — deleted immediately after processing (typically within seconds).

**Deleted accounts:** When you delete your account, it is immediately deactivated and all personal data — including your profile, session transcripts, scores, and performance metrics — is permanently and irreversibly erased from our live systems within 30 days. You will receive a reminder email 7 days before the final deletion, with a link to restore your account if you change your mind.

**Backups:** Our database provider (Supabase) maintains daily backups for disaster recovery, retained for up to 7 days. After your data is erased from our live systems, a copy may remain in these backups for up to 7 additional days before being permanently overwritten. Backups are not accessed except to restore the database in the event of a failure.

## 5. Your rights under GDPR

If you are located in the European Economic Area or UK, you have the following rights:

**Right of access:** You can download a copy of all data we hold about you from your Account Settings page.

**Right to rectification:** You can update your profile information at any time in Account Settings.

**Right to erasure:** You can delete your account and all associated data from Account Settings. We will erase everything from our live systems within 30 days, and from backups within a further 7 days (see Section 4).

**Right to portability:** Your data export (available in Settings) is provided in JSON format, which can be read by any standard tool.

**Right to object:** You may object to processing based on legitimate interests. Contact us at info@selfcraftpartners.com.

**Right to withdraw consent:** Where we process data based on your consent (audio, video, biometric metrics), you may withdraw consent at any time by deleting your account. Withdrawal does not affect the lawfulness of processing before withdrawal.

**Right to lodge a complaint:** You have the right to lodge a complaint with your national data protection supervisory authority.

To exercise any of these rights, contact us at info@selfcraftpartners.com. We will respond within 30 days.

## 6. Data security

We use industry-standard security measures including encrypted connections (TLS), secure password hashing (bcrypt), and access controls. Your data is stored in EU-based infrastructure. However, no system is 100% secure and we cannot guarantee absolute security of your data.

## 7. Cookies

Gravitas uses only essential functional cookies required to keep you logged in. We do not use advertising, analytics, or tracking cookies. No cookie consent banner is required for strictly necessary cookies under GDPR.

## 8. Children

Gravitas is not directed at children under 16. We do not knowingly collect personal data from anyone under 16. If you believe a child has provided us with personal data, please contact us at info@selfcraftpartners.com and we will delete it promptly.

## 9. Changes to this policy

We may update this Privacy Policy from time to time. When we do, we will update the "Last updated" date at the top of this page and, for material changes, notify you by email. Continued use of Gravitas after a policy update constitutes your acceptance of the new terms.

## 10. Contact

For any privacy-related questions, data subject access requests, or complaints, contact our privacy team at info@selfcraftpartners.com.

*Gravitas AI · Privacy Policy v1.1 · Last updated 28 August 2026*

---

# PART K — Terms of Service (Full Published Text)

*Source: `artifacts/ep-app/src/pages/terms.tsx`, served at `/terms`. Last updated 30 July 2026. Reproduced verbatim.*

## 1. Acceptance of terms

By creating an account on Gravitas AI ("Gravitas", "we", "us", "our"), you agree to be bound by these Terms of Service and our Privacy Policy. If you do not agree to these terms, do not use the service.

## 2. Description of service

Gravitas is an AI-powered communication coaching platform that analyses voice and video recordings to provide feedback on executive presence, communication effectiveness, and delivery. The platform is currently in Beta and is provided for personal professional development purposes.

## 3. Eligibility

You must be at least 16 years old to use Gravitas. By creating an account, you confirm you meet this age requirement. Gravitas is intended for individual professional use, not for commercial resale or redistribution.

## 4. Your account

You are responsible for maintaining the confidentiality of your account credentials. You must notify us immediately at info@selfcraftpartners.com if you suspect unauthorised access to your account.

You are responsible for all activity that occurs under your account. You may not share your account with others or create accounts on behalf of third parties without their consent.

## 5. Recordings and content

When you submit a recording, you grant Gravitas a limited, non-exclusive licence to process that recording solely for the purpose of providing coaching analysis and feedback to you. We do not use your recordings to train AI models.

You must not submit recordings containing third parties without their consent. You must not submit recordings containing sensitive information about others (e.g., confidential business information, other people's private details).

You retain all rights to content you create. Gravitas retains the analysis and feedback derived from your content as part of your account.

## 6. Acceptable use

You agree not to:

- Use Gravitas for any unlawful purpose
- Attempt to reverse-engineer, scrape, or copy the platform
- Submit content that is abusive, defamatory, or violates the rights of others
- Use automated tools to access the platform without our written permission
- Attempt to circumvent security or access controls
- Resell or sublicence access to the platform

## 7. Beta service

Gravitas is currently in Beta. This means the service may be unstable, contain bugs, or change significantly. We provide the Beta service "as is" and make no guarantees about its availability, accuracy, or fitness for any particular purpose. Feedback you provide during Beta may be used to improve the service.

Our scoring methodology, dimensions, and criteria may be updated, recalibrated, or changed over time as the service evolves. Scores and feedback generated at different points in time, or under different methodology versions, may not be directly comparable.

## 7a. Scheduled sessions and availability

Where you plan to use Gravitas at a specific date or time, we will use reasonable efforts to ensure the Service is available but cannot guarantee that the Service, or any third-party provider it depends on (see Section 8), will be available or fully operational at that time. We recommend building reasonable buffer time into time-sensitive plans. Gravitas does not accept liability for costs, damages, or reputational harm arising from third-party service unavailability during a planned session.

## 8. AI-generated content

Coaching feedback and scores generated by Gravitas are produced by artificial intelligence and are for informational and developmental purposes only. They do not constitute professional advice. Gravitas makes no warranties about the accuracy or completeness of AI-generated feedback. You should not rely solely on Gravitas feedback for important professional decisions. Gravitas does not guarantee any specific outcome, including but not limited to improved performance evaluations, interview success, promotion, or academic results.

Gravitas relies on third-party artificial intelligence providers (including but not limited to Anthropic and OpenAI) to process recordings and generate feedback. The availability, performance, and accuracy of the Service depend on the continued availability and performance of these third-party providers. Gravitas does not control and is not responsible for outages, degraded performance, model changes, or service interruptions caused by third-party AI providers. In the event of such a disruption, you may experience delays, incomplete results, or temporary unavailability of the Service.

## 9. Intellectual property

All intellectual property in the Gravitas platform, including its design, scoring methodology, software, and content (excluding your personal data), is owned by Gravitas AI. You are granted a limited, non-transferable licence to use the platform for personal professional development. Nothing in these terms transfers any intellectual property rights to you.

## 10. Limitation of liability

To the maximum extent permitted by applicable law, Gravitas AI shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of profits or data, arising from your use of the service. Our total liability to you for any claim arising from these terms shall not exceed the amount you paid us in the 12 months preceding the claim.

Gravitas shall not be liable for any failure or delay in performance resulting from causes beyond its reasonable control, including but not limited to failure or unavailability of third-party AI models, cloud infrastructure, or internet service providers.

## 11. Termination

You may delete your account at any time from Account Settings. We may suspend or terminate your account if you violate these terms, with or without notice. Upon termination, your right to use the service ceases immediately.

## 12. Changes to terms

We may update these terms from time to time. We will notify you of material changes by email. Continued use of the service after the effective date of changes constitutes acceptance of the new terms.

## 13. Governing law

These terms are governed by and construed in accordance with applicable law. Any disputes arising from these terms or the use of the service shall be subject to the exclusive jurisdiction of the appropriate courts.

## 14. Contact

For questions about these Terms of Service, contact us at info@selfcraftpartners.com.

*Gravitas AI · Terms of Service · Last updated 30 July 2026*

---

# PART L — Consent Capture (As Presented to Users)

## L.1 Signup consent

Source: `artifacts/ep-app/src/pages/signup.tsx`. A single required checkbox, unchecked by default; the submit button is disabled until it is ticked. The consent flag is passed to `POST /v1/auth/signup`, which writes `consent_accepted_at = now()` and `privacy_policy_version = "1.0"`.

Checkbox label text:

> I agree to the **Terms of Service** and **Privacy Policy**

*(both terms are links opening `/terms` and `/privacy` in a new tab)*

**Note for the reviewer:** this is the wording of the *only* consent obtained at signup. The words "biometric", "voice", "video", and "special category" do not appear. Explicit Art. 9(2)(a) consent for biometric processing is therefore obtained, at signup, solely by incorporation of the Privacy Policy by reference. Gravitas' view is that this is insufficient for explicit consent. See Gap 11.

## L.2 In-app re-consent gate

Source: `artifacts/ep-app/src/components/consent-gate.tsx`. A blocking modal shown when `user.consentAcceptedAt === null`. Cannot be dismissed. On acceptance, calls `POST /v1/users/me/consent` with `{ consentAccepted: true }`, writing the timestamp and version `"1.0"`.

Full text as displayed:

> ### We've updated our Terms & Privacy Policy
>
> To continue using Gravitas, please review and accept our updated policies. These cover how we handle your voice recordings, session data, and AI-generated feedback.
>
> ---
>
> **What we process:** Your audio/video recordings, transcripts, and coaching feedback.
>
> **Who sees it:** OpenAI (transcription) and Anthropic (coaching analysis). Neither trains on your data.
>
> **How long we keep it:** Session history is kept for the lifetime of your account so you can track long-term progress. You can delete individual sessions or your entire account at any time.
>
> ---
>
> ☐ I agree to the **Terms of Service** and **Privacy Policy**, including processing of my voice and video by AI services to deliver coaching.
>
> [ Accept and continue ]

**Notes for the reviewer:**

- This wording is materially better than the signup checkbox — it names voice and video processing explicitly and summarises processors and retention in the layered-notice style. It is, however, shown **only to users whose `consent_accepted_at` is null**, i.e. legacy users who predate consent capture. New users see only the weaker signup checkbox (L.1).
- The heading *"We've updated our Terms & Privacy Policy"* describes a function the component cannot perform: because the trigger is a null check rather than a version comparison, this gate **can never fire on a policy update.** See Gap 18.
- The "Who sees it" line omits Google (Gap 4) and describes OpenAI as transcription only (Gap 5).

---

# Appendix — Source Files Examined

Provided so the reviewer can direct follow-up questions or request extracts.

| Area | Path |
|---|---|
| Privacy Policy (published) | `artifacts/ep-app/src/pages/privacy.tsx` |
| Terms of Service (published) | `artifacts/ep-app/src/pages/terms.tsx` |
| Signup consent UI | `artifacts/ep-app/src/pages/signup.tsx` |
| Re-consent gate | `artifacts/ep-app/src/components/consent-gate.tsx` |
| Consent trigger logic | `artifacts/ep-app/src/lib/auth-context.tsx` |
| Token storage | `artifacts/ep-app/src/lib/api.ts` |
| Recording capture flow | `artifacts/ep-app/src/pages/record.tsx` |
| App security config (helmet, CORS, logging) | `artifacts/api-server/src/app.ts` |
| Logger redaction | `artifacts/api-server/src/lib/logger.ts` |
| Auth, Google sign-in, restore | `artifacts/api-server/src/routes/auth.ts` |
| Profile, export, deletion, consent | `artifacts/api-server/src/routes/users.ts` |
| Recording pipeline | `artifacts/api-server/src/routes/sessions.ts` |
| Admin/staff data access | `artifacts/api-server/src/routes/admin.ts` |
| Email templates and senders | `artifacts/api-server/src/lib/email.ts` |
| Database schemas | `lib/db/src/schema/*.ts` |
| SQL migrations | `scripts/sql/` |
| Existing DPIA | `legal/dpia.md` |
| Existing RoPA | `legal/ropa.md` |
| Scoring methodology (context for Art. 22) | `METHODOLOGY.md` |

**Document ends.**
