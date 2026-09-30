# Data Protection Impact Assessment (DPIA)
**Gravitas AI**
Version 1.2 — 28 August 2026
Prepared by: Kanza Azeemi (Data Controller)
Review date: 25 June 2027

---

## 1. Overview

This DPIA is conducted pursuant to Article 35 of the UK/EU General Data Protection Regulation (GDPR). A DPIA is required because Gravitas AI processes **biometric data** (voice recordings and video frames from which behavioural characteristics are derived) and **special category data** on a systematic basis.

**Product:** Gravitas AI — an AI-powered communication coaching platform that analyses voice and video recordings to provide feedback on executive presence and communication effectiveness.

**Data Controller:** Gravitas AI / Kanza Azeemi
**Contact:** info@selfcraftpartners.com

---

## 2. Description of Processing

### 2.1 What data is processed

| Data Category | Examples | GDPR Classification |
|---|---|---|
| Identity data | Name, email address (including via Google Sign-In) | Personal data |
| Professional profile | Role, career stage, goals, industry, interview details, employer/organisation name | Personal data |
| Voice recordings | Audio of speech during practice sessions | Biometric data (special category) |
| Video frames | Still images from video sessions for facial analysis | Biometric data (special category) |
| Transcripts | Word-for-word text of speech | Personal data |
| Behavioural biometrics | Speech rate, filler word frequency, pause patterns, vocal frequency (F0), eye contact rate | Biometric data (special category) |
| Coaching feedback | AI-generated scoring and commentary | Personal data |
| Consent records | Timestamp, and version of both the Privacy Policy and Terms of Service accepted | Personal data |
| AI usage telemetry | Internal record of which AI operation, model, and cost applied to a session | Personal data (low sensitivity, internal use only) |

### 2.2 Purpose of processing

The sole purpose is to provide personalised AI coaching feedback to the user on their communication style and executive presence. No data is used for advertising, profiling for third-party purposes, or resale.

### 2.3 Legal basis

| Data type | Legal basis |
|---|---|
| Account data, transcripts, session history | Article 6(1)(b) — performance of contract |
| Voice recordings, video frames, biometric metrics | Article 6(1)(a) + Article 9(2)(a) — explicit consent |
| Consent records | Article 6(1)(c) — legal obligation |
| Internal AI usage telemetry | Article 6(1)(f) — legitimate interests (cost/operations monitoring) |

**Open question for external review:** account data and transcripts rest on contract performance, while the voice/video recording that produces them rests on consent. Since a transcript cannot exist without the underlying recording, and there is currently no way to withdraw consent for the recording without also losing access to derived transcripts of past sessions, external advice is being sought on whether this split legal basis is coherent as currently structured. See §5 on how withdrawal is designed to work in practice.

### 2.4 Who has access

| Recipient | Role | Location | Transfer mechanism |
|---|---|---|---|
| Gravitas AI (internal) | Data controller | N/A | N/A |
| Supabase | Database hosting | EU (Frankfurt) | EU adequacy / standard contract |
| OpenAI | Speech-to-text transcription and vocal delivery analysis | USA | Standard Contractual Clauses (SCCs) |
| Anthropic | AI coaching analysis, video frame analysis | USA | Standard Contractual Clauses (SCCs) |
| Resend | Transactional and account-related email delivery | EU-compliant | DPA in place |
| Google | Sign-in identity verification (only for users who choose this option) | USA | Google's standard contractual protections |
| Railway | Application hosting (server memory only; no independent access to stored data) | To confirm exact region | To confirm |

### 2.5 Data flows

1. User submits audio/video recording via the browser.
2. Audio is sent to OpenAI's API **twice**, for two distinct purposes: speech-to-text transcription, and vocal delivery/prosody analysis. Video frames are extracted in memory (not persisted).
3. Transcript, video frames, and professional context are sent to Anthropic's Claude API for coaching analysis.
4. Audio and video frames are discarded when the request completes (never written to disk; become eligible for garbage collection once processing finishes — see §3.3 for a note on the precision of this claim).
5. Transcript, scores, and coaching feedback are stored in Supabase (EU-hosted PostgreSQL).
6. User accesses their results via the Gravitas web application.
7. If the user signs in with Google, a one-time identity verification round-trip occurs with Google at login/signup — this does not touch coaching data.

### 2.6 Retention

- Audio/video: never stored — held in server memory only during the request, then eligible for garbage collection
- Transcripts, scores, and feedback: retained for the lifetime of the user's account
- Account data: retained until account deletion + 30-day grace period
- On account deletion: all data is now genuinely and verifiably erased from live systems within 30 days (see §5 — this mechanism was previously documented but not implemented; it has since been built, deployed, and verified against production)
- Database backups: Gravitas' database provider currently retains no backups at all (Free plan); a planned upgrade to a paid plan will introduce 7-day backup retention, meaning an erased record could persist in a backup for up to 7 further days once that upgrade takes effect. Not yet applicable today.

---

## 3. Necessity and Proportionality

### 3.1 Is the processing necessary?

Yes. The core function of Gravitas — providing personalised, data-driven feedback on communication effectiveness — cannot be achieved without analysing the user's actual voice and, for video sessions, their visual delivery. There is no less privacy-invasive way to deliver the same outcome.

### 3.2 Is the processing proportionate?

Yes, for the following reasons:
- Users provide consent before any recording is processed, at signup and via a version-tracked re-consent screen whenever the Privacy Policy or Terms materially change
- Audio and video are never stored — processed entirely in memory and discarded
- Derived metrics (scores, transcripts) are stored only to provide the user with their own progress history
- **Consent for future recordings is inherently easy to withdraw**: because each recording is a fresh, deliberate act (choosing audio or video mode, granting browser camera/microphone access, and initiating the recording) and nothing is stored between sessions, simply not submitting another recording is itself a complete and immediate withdrawal of consent for further biometric processing — no account action is required. This is considered at least as easy as giving consent. Withdrawing consent for future recordings does not, by itself, delete transcripts/scores already derived from past sessions (those are retained under the contract basis in §2.3); a user who additionally wants that data erased can use the separate right to erasure (account deletion).
- Data is not used for any purpose beyond coaching the individual user

**External review requested:** please confirm the withdrawal reasoning above is sound under Article 7(3), and separately confirm whether obtaining consent for audio and video processing via a single, non-granular checkbox (rather than separately) is adequate given that a user's actual choice of audio-only vs. video mode is made per session, not at consent time.

### 3.3 Data minimisation measures

- Only up to 20 video frames per session are sent to Claude (not the full video)
- Professional context sent to Anthropic is limited to what the user has voluntarily provided
- No raw audio or video is stored at rest
- **Note on precision of language:** audio and video buffers are not stored to disk or database at any point, and become eligible for garbage collection once the request handler completes. This DPIA previously used stronger language ("deleted within seconds," "discarded immediately") than is technically precise — there is no explicit zeroing of memory. The practical risk of this distinction is considered very low, but the wording has been corrected here for accuracy.

---

## 4. Risk Assessment

| Risk | Likelihood | Severity | Inherent Risk | Mitigating Controls | Residual Risk |
|---|---|---|---|---|---|
| Unauthorised access to transcripts/scores in database | Low | High | Medium | TLS encryption in transit; strong authentication; JWT auth; every query filters on the authenticated user's own ID at the application layer | Low |
| Voice data intercepted in transit to OpenAI | Very Low | High | Medium | TLS 1.3 encryption on all API calls, no logging of audio content | Low |
| Video frames intercepted in transit to Anthropic | Very Low | High | Medium | TLS 1.3 encryption, frames not stored, ephemeral processing | Low |
| Data breach at third-party processor (OpenAI/Anthropic/Google) | Low | High | Medium | DPAs with SCCs in place, processors do not train on API data, limited data sent | Low–Medium |
| Accidental exposure of biometric data via logs | Low | High | Medium | Pino logger configured to redact auth headers and strip query strings; audio/video never logged | Low |
| Internal staff (admin) access to a user's transcript or profile without a legitimate reason | Low | Medium | Medium | Admin access is restricted to authenticated administrators and is now audit-logged (admin ID, timestamp, record accessed) on every transcript/profile view | Low |
| Disclosure of the interview/employer profile (e.g. that a named user is interviewing at a named competitor on a specific date) to an unintended party | Low | High | Medium | Data is only accessible to the authenticated user and audit-logged admin access; not shared with any third party; users are not required to provide this information | Low–Medium |
| User loses access to their progress data | Low | Medium | Low | Self-service data export; account restore window before permanent deletion | Very Low |
| Consent not properly recorded, or not re-requested after a material policy change | Very Low | High | Medium | Consent timestamp and both document versions (Privacy Policy, Terms) stored on every signup and re-consent; re-consent is automatically triggered by comparing stored versions against current ones | Very Low |
| Data retained beyond intended period | Low | Medium | Low | Automated hourly purge job permanently deletes accounts 30 days after a deletion request; deletion cascades correctly at the database level; this mechanism is implemented and verified in production | Very Low |
| Children's data processed | Very Low | High | Medium | Minimum age 16 stated in Terms; signup requires explicit agreement | Very Low |

### 4.1 Residual risk conclusion

All identified risks have been reduced to Low or Very Low through the technical and organisational measures described above. No residual high risks remain, on the basis of the corrected controls listed above. This conclusion should be confirmed by external review, particularly given the interview/employer profile risk and the open legal-basis question in §2.3.

---

## 5. Data Subject Rights

Gravitas has implemented the following mechanisms to fulfil data subject rights:

| Right | Implementation |
|---|---|
| Access (Art. 15) | Self-service data export in JSON format available in Account Settings |
| Rectification (Art. 16) | Profile fields, including email address (with re-verification), editable at any time in Account Settings |
| Erasure (Art. 17) | Account deletion in Settings; data purged from live systems within 30 days via an automated, verified purge job |
| Portability (Art. 20) | JSON export covering personal data and session history |
| Withdraw consent (Art. 7(3)) | For future audio/video processing: simply do not submit further recordings — see §3.2. For erasure of data already derived from past sessions: delete the account. Withdrawal does not affect the lawfulness of processing before withdrawal |
| Object (Art. 21) | Contact info@selfcraftpartners.com |
| Lodge complaint | Right to complain to a supervisory authority communicated in the Privacy Policy (the specific authority is not yet named — see open establishment question) |

---

## 6. Consultation

As a small business processing biometric data, Gravitas AI initially conducted this DPIA internally. **This version is being submitted for external review by a data protection consultant.** The open questions flagged throughout this document (§2.3, §3.2, and the establishment/lead authority question) are specifically being put to that review rather than resolved unilaterally.

No unresolved high risks have been identified as of this version, subject to the outcome of that external review.

---

## 7. Sign-off

| Role | Name | Date |
|---|---|---|
| Data Controller | Kanza Azeemi | 25 June 2026 (v1.0) |

**Next review date:** 25 June 2027, or earlier if processing activities change materially, or upon completion of the current external review.

---

## Version History

- **1.0 — 25 June 2026:** Initial version.
- **1.1 — 25 June 2026:** Added employer/organisation name to professional profile data category (collected via workplace onboarding step).
- **1.2 — 28 August 2026:** Corrected the following inaccuracies found on internal review: removed a claim that Supabase row-level security was in place (it was not — the actual control is consistent application-layer filtering, now described accurately); corrected retention language that overstated the precision of memory disposal; disclosed the second OpenAI processing purpose (vocal delivery analysis); disclosed Google Sign-In and Railway hosting; disclosed audit logging of admin access; corrected the erasure mechanism from "documented but not built" to "implemented and verified in production"; added the interview/employer-profile risk and the internal-access risk to the risk table; corrected the consent-withdrawal mechanism description; flagged the split legal-basis and consent-granularity questions for external review rather than asserting they are resolved.

*This DPIA should be updated whenever there is a significant change to the data processing described above — for example, adding a new AI provider, changing data retention periods, or expanding to new categories of data.*
