# Data Protection Impact Assessment (DPIA)
**Gravitas AI**
Version 1.0 — 25 June 2026
Prepared by: Kanza Azeemi (Data Controller)
Review date: 25 June 2027

---

## 1. Overview

This DPIA is conducted pursuant to Article 35 of the UK/EU General Data Protection Regulation (GDPR). A DPIA is required because Gravitas AI processes **biometric data** (voice recordings and video frames from which behavioural characteristics are derived) and **special category data** on a systematic basis.

**Product:** Gravitas AI — an AI-powered communication coaching platform that analyses voice and video recordings to provide feedback on executive presence and communication effectiveness.

**Data Controller:** Gravitas AI / Kanza Azeemi
**Contact:** privacy@gravitas.ai

---

## 2. Description of Processing

### 2.1 What data is processed

| Data Category | Examples | GDPR Classification |
|---|---|---|
| Identity data | Name, email address | Personal data |
| Professional profile | Role, career stage, goals, industry, interview details, employer/organisation name | Personal data |
| Voice recordings | Audio of speech during practice sessions | Biometric data (special category) |
| Video frames | Still images from video sessions for facial analysis | Biometric data (special category) |
| Transcripts | Word-for-word text of speech | Personal data |
| Behavioural biometrics | Speech rate, filler word frequency, pause patterns, vocal frequency (F0), eye contact rate | Biometric data (special category) |
| Coaching feedback | AI-generated scoring and commentary | Personal data |
| Consent records | Timestamp and version of privacy policy accepted | Personal data |

### 2.2 Purpose of processing

The sole purpose is to provide personalised AI coaching feedback to the user on their communication style and executive presence. No data is used for advertising, profiling for third-party purposes, or resale.

### 2.3 Legal basis

| Data type | Legal basis |
|---|---|
| Account data, transcripts, session history | Article 6(1)(b) — performance of contract |
| Voice recordings, video frames, biometric metrics | Article 6(1)(a) + Article 9(2)(a) — explicit consent |
| Consent records | Article 6(1)(c) — legal obligation |

### 2.4 Who has access

| Recipient | Role | Location | Transfer mechanism |
|---|---|---|---|
| Gravitas AI (internal) | Data controller | N/A | N/A |
| Supabase | Database hosting | EU (Frankfurt) | EU adequacy / standard contract |
| OpenAI | Speech-to-text transcription | USA | Standard Contractual Clauses (SCCs) |
| Anthropic | AI coaching analysis, video frame analysis | USA | Standard Contractual Clauses (SCCs) |
| Resend | Transactional email delivery | EU-compliant | DPA in place |

### 2.5 Data flows

1. User submits audio/video recording via the browser.
2. Audio is sent to OpenAI's API for transcription. Video frames are extracted in memory (not persisted).
3. Transcript, video frames, and professional context are sent to Anthropic's Claude API for coaching analysis.
4. Audio and video frames are discarded immediately after processing (never stored).
5. Transcript, scores, and coaching feedback are stored in Supabase (EU-hosted PostgreSQL).
6. User accesses their results via the Gravitas web application.

### 2.6 Retention

- Audio/video: never stored — deleted within seconds of processing
- Transcripts, scores, and feedback: retained for the lifetime of the user's account
- Account data: retained until account deletion + 30-day grace period
- On account deletion: all data permanently erased within 30 days

---

## 3. Necessity and Proportionality

### 3.1 Is the processing necessary?

Yes. The core function of Gravitas — providing personalised, data-driven feedback on communication effectiveness — cannot be achieved without analysing the user's actual voice and, for video sessions, their visual delivery. There is no less privacy-invasive way to deliver the same outcome.

### 3.2 Is the processing proportionate?

Yes, for the following reasons:
- Users provide explicit, informed consent before any recording is processed
- Audio and video are never stored — processed entirely in memory and discarded
- Derived metrics (scores, transcripts) are stored only to provide the user with their own progress history
- Users can delete their data at any time, including individual sessions or their entire account
- Data is not used for any purpose beyond coaching the individual user

### 3.3 Data minimisation measures

- Only audio is sent to OpenAI (not video)
- Only up to 20 video frames per session are sent to Claude (not the full video)
- Professional context sent to Anthropic is limited to what the user has voluntarily provided
- No raw audio or video is stored at rest

---

## 4. Risk Assessment

| Risk | Likelihood | Severity | Inherent Risk | Mitigating Controls | Residual Risk |
|---|---|---|---|---|---|
| Unauthorised access to transcripts/scores in database | Low | High | Medium | TLS encryption in transit, Supabase RLS, strong authentication, JWT auth | Low |
| Voice data intercepted in transit to OpenAI | Very Low | High | Medium | TLS 1.3 encryption on all API calls, no logging of audio content | Low |
| Video frames intercepted in transit to Anthropic | Very Low | High | Medium | TLS 1.3 encryption, frames not stored, ephemeral processing | Low |
| Data breach at third-party processor (OpenAI/Anthropic) | Low | High | Medium | DPAs with SCCs in place, processors do not train on API data, limited data sent | Low–Medium |
| Accidental exposure of biometric data via logs | Low | High | Medium | Pino logger configured to redact auth headers; audio/video never logged | Low |
| User loses access to their progress data | Low | Medium | Low | Soft delete with 30-day grace period, self-service data export | Very Low |
| Consent not properly recorded | Very Low | High | Medium | Consent timestamp and policy version stored in DB on every signup | Very Low |
| Data retained beyond intended period | Low | Medium | Low | Explicit user deletion flow; automated 30-day purge after account deletion | Very Low |
| Children's data processed | Very Low | High | Medium | Minimum age 16 stated in Terms; signup requires explicit agreement | Very Low |

### 4.1 Residual risk conclusion

All identified risks have been reduced to Low or Very Low through the technical and organisational measures described above. No residual high risks remain. The processing can proceed.

---

## 5. Data Subject Rights

Gravitas has implemented the following mechanisms to fulfil data subject rights:

| Right | Implementation |
|---|---|
| Access (Art. 15) | Self-service data export in JSON format available in Account Settings |
| Rectification (Art. 16) | Profile fields editable at any time in Account Settings |
| Erasure (Art. 17) | Account deletion in Settings; all data purged within 30 days |
| Portability (Art. 20) | JSON export covering all personal data and session history |
| Withdraw consent (Art. 7(3)) | Delete account at any time; withdrawal does not affect prior lawful processing |
| Object (Art. 21) | Contact privacy@gravitas.ai |
| Lodge complaint | Right to complain to relevant supervisory authority communicated in Privacy Policy |

---

## 6. Consultation

As a small business processing biometric data, Gravitas AI has conducted this DPIA internally. If this assessment identifies any unresolved high risks, consultation with the relevant supervisory authority will be sought before processing commences.

No unresolved high risks have been identified.

---

## 7. Sign-off

| Role | Name | Date |
|---|---|---|
| Data Controller | Kanza Azeemi | 25 June 2026 |

**Version 1.1 — 25 June 2026:** Added employer/organisation name to professional profile data category (collected via workplace onboarding step).

**Next review date:** 25 June 2027, or earlier if processing activities change materially.

---

*This DPIA should be updated whenever there is a significant change to the data processing described above — for example, adding a new AI provider, changing data retention periods, or expanding to new categories of data.*
