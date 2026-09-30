# Gravitas AI — GDPR Review Brief

**Prepared for:** External data protection consultant
**Prepared by:** Kanza Azeemi, Founder
**Date:** 28 August 2026
**Product:** Gravitas AI — an AI-powered communication coaching platform
**Website:** https://gravitas.selfcraftpartners.com

---

## 1. What Gravitas does

Gravitas lets a user record a short practice speaking session — audio only, or audio with video — in their browser. The recording is analysed by AI to produce a score and written feedback across several dimensions of communication (clarity, confidence, delivery, etc.). The user can review their results and track progress over multiple sessions.

The product is currently in **Beta**, offered on a **free trial basis**, with a small number of users (fewer than 15 at the time of writing).

## 2. What data is collected, and why

| Category | What it includes | Why we collect it |
|---|---|---|
| Account details | Name, email address, password | To create and manage the account |
| Professional profile | Career stage, role, industry, goals, and (optionally) interview details such as target company and date | To personalise coaching feedback |
| Voice recordings | Audio of the user speaking during a session | To generate a transcript and analyse delivery |
| Video (optional) | Video frames captured during a video session | To analyse physical delivery (eye contact, posture, expression) |
| Transcript and feedback | Text transcript of the session, and the AI-generated coaching feedback and scores | To show the user their results and progress over time |
| Consent records | When, and which version of our policies, a user agreed to | To demonstrate valid consent |

**Important: we never store the raw audio or video itself.** It is processed in the moment a session is submitted and then discarded — nothing is written to a database or disk. Only the *outputs* of that processing (transcript, scores, written feedback) are kept.

We do not use any data for advertising, and we do not sell data to third parties.

## 3. Legal basis for processing

- **Account data, transcripts, and stored feedback** — necessary to provide the service the user signed up for (performance of a contract).
- **The act of recording and analysing voice and video** — the user's explicit consent, since we treat this as biometric special category data.
- **Consent records themselves** — kept to meet our own legal obligation to demonstrate consent was given.

**A specific question we'd like your view on:** is it correct to classify voice/video processed for behavioural coaching feedback as special-category biometric data requiring explicit consent (Article 9), given the purpose is coaching rather than identifying the person? We've taken the more cautious position, but would welcome confirmation either way, since it affects how consent is structured.

## 4. Who we share data with

| Provider | What they receive | Location |
|---|---|---|
| OpenAI | Voice recording, for transcription and for analysing vocal delivery | USA |
| Anthropic | Transcript, professional context, and video frames, for generating coaching feedback | USA |
| Google | Name and email, only if the user chooses to sign in with Google | USA |
| Resend | Email address and name, to send account emails | EU |
| Supabase | All stored account and session data (database hosting) | EU (Germany) |
| Railway | Passes data through in transit while running our servers; does not independently access stored data | To be confirmed |

None of our AI providers train their models on our users' data. All non-EU transfers rely on Standard Contractual Clauses or equivalent protections.

**A question we'd like your view on:** we have not conducted a formal Transfer Impact Assessment for the US-based providers above. We'd like your guidance on what's required here, and whether pursuing enhanced data-residency terms with these providers should be a priority.

## 5. How long we keep data, and how deletion works

- Session history is kept for as long as the account is active, since tracking progress over time is the point of the product.
- When a user deletes their account, all of their data is automatically and permanently deleted from our live systems within 30 days. This is fully automated and has been tested end-to-end.
- We currently keep no backups of our database at all. We plan to move to a backup plan that retains data for up to 7 days for disaster-recovery purposes; our Privacy Policy already discloses this upcoming 7-day window so it doesn't need updating again once the change takes effect.

## 6. How consent and withdrawal work

A user agrees to our Terms and Privacy Policy once, at signup, and is asked to re-agree whenever we materially change either document (we compare the version they last agreed to against the current version automatically).

**On withdrawing consent:** because we only process voice/video at the moment a recording is submitted, and never retain the raw recording afterward, a user withdraws consent for *future* processing simply by not submitting another recording — there is nothing to switch off. If they also want previously generated transcripts and scores deleted, that's a separate action (account deletion), covered by the right to erasure rather than consent withdrawal.

**A question we'd like your view on:** we currently obtain one combined consent covering both audio and video processing, rather than two separate consents. Our reasoning is that the user's actual choice of audio-only vs. video mode happens per session (via a mode selector), which we think functions as the specific, in-the-moment consent event — the checkbox at signup is a general disclosure layered on top of that. We'd like you to confirm whether this structure is adequate, or whether it needs to be more explicitly granular.

## 7. Data subject rights — how each is fulfilled

| Right | How a user exercises it |
|---|---|
| Access | Self-service data export from account settings |
| Rectification | Editable profile fields, including their email address |
| Erasure | Self-service account deletion, automated end to end |
| Portability | Same data export, in a standard machine-readable format |
| Object / restrict | By contacting us directly |
| Withdraw consent | Simply stop recording (see Section 6) |
| Complain to a regulator | Stated in our Privacy Policy |

We also keep an internal log for any rights request that arrives outside the self-service flow, so nothing is missed against the one-month response deadline.

## 8. Security measures

- All connections are encrypted in transit.
- Passwords are hashed, never stored in plain text.
- Every user's data is only accessible to that user, enforced consistently at the application level.
- Internal staff access to user data (for support purposes) is logged — who accessed what, and when.
- We have a written incident response procedure covering the 72-hour regulatory notification requirement.

## 9. Questions we specifically want your input on

These are the points where we think a genuine professional judgment is needed, rather than something we can resolve ourselves:

1. **Where are we established, for GDPR purposes, and who is our lead supervisory authority?** We are incorporating in Ontario, Canada, but serve users in the UK, EU, and UAE. This affects whether we need an Article 27 representative, and it's a prerequisite for several of the other questions below.
2. **Do we need a Data Protection Officer?** We process biometric data as our core activity, but at very low volume (Beta, <15 users). At what point does this become "large scale" under Article 37?
3. **Is our biometric data classification and legal basis structure correct** (Section 3 above)?
4. **Is our consent design adequate** (Section 6 above)?
5. **What's required for our international data transfers to the US** (Section 4 above)?
6. **What do we need to have in place before we take on organisational/enterprise clients?** We're in early discussions for pilots with businesses and institutions, which would introduce a different legal relationship (Gravitas as processor rather than sole controller) and different considerations around automated decision-making, since scores would be visible to an employer or institution rather than just the individual. Nothing is live yet, but we'd like to know what to prepare before it is.

## 10. What's attached

- **Appendix A:** Current Privacy Policy (in force)
- **Appendix B:** Current Terms of Service (in force)

We're happy to provide our internal Record of Processing Activities and Data Protection Impact Assessment in full if useful for your review — just let us know.

---

# Appendix A — Privacy Policy

*Version 1.2, last updated 28 August 2026*

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

**OpenAI (United States).** Your audio recording is sent to OpenAI's API for two purposes: speech-to-text transcription, and analysis of your vocal delivery (tone, pacing, and prosody). Your voice is biometric data under GDPR. OpenAI may retain audio for up to 30 days for abuse prevention purposes in accordance with their data retention policy. We rely on Standard Contractual Clauses (SCCs) for this international data transfer.

**Anthropic (United States).** Your session transcript, coaching context (role, goals, industry), and video frames (for video sessions) are sent to Anthropic's Claude API for AI-powered coaching analysis and scoring. Anthropic does not train on API data by default. We rely on Standard Contractual Clauses (SCCs) for this international data transfer.

**Google (Sign-In).** If you choose to sign in or sign up using Google, Google verifies your identity and shares your name and email address with us to create or access your account. This is governed by Google's own privacy policy in addition to ours. We rely on Google's standard contractual protections for this international data transfer.

**Resend (email delivery).** Your email address and name are shared with Resend to deliver transactional and account-related emails (verification, password reset, deletion notices, and onboarding/product emails). Resend is GDPR-compliant and does not use your data for marketing.

**Supabase (database hosting, EU).** Your data is stored on PostgreSQL databases hosted by Supabase in the EU (Frankfurt, Germany). Supabase is GDPR-compliant and your data remains within the EU.

**Railway (application hosting).** Our application server, which processes your requests and briefly holds audio/video in memory during analysis, is hosted by Railway. Railway does not have independent access to your stored data, which resides with Supabase as described above.

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

**Right to withdraw consent:** We only process your voice and video at the moment you choose to submit a recording, and we never store the raw audio or video afterward. Because of this, you can withdraw consent for future audio/video processing at any time simply by not submitting further recordings — no action is required, and this is at least as easy as giving consent in the first place. If you also want to delete data already derived from past sessions (transcripts, scores, and feedback), you can exercise your separate right to erasure by deleting your account (see above). Withdrawal does not affect the lawfulness of processing before withdrawal.

**Right to lodge a complaint:** You have the right to lodge a complaint with your national data protection supervisory authority.

To exercise any of these rights, contact us at info@selfcraftpartners.com. We will respond within 30 days.

## 6. Data security

We use industry-standard security measures including encrypted connections (TLS), secure password hashing (bcrypt), and access controls. Your data is stored in EU-based infrastructure. However, no system is 100% secure and we cannot guarantee absolute security of your data.

## 7. Cookies and local storage

Gravitas does not use cookies. To keep you logged in, we store a strictly necessary authentication token in your browser's local storage. We do not use advertising, analytics, or tracking cookies or similar technologies. No consent banner is required for this strictly necessary storage under GDPR and the ePrivacy rules.

## 8. Children

Gravitas is not directed at children under 16. We do not knowingly collect personal data from anyone under 16. If you believe a child has provided us with personal data, please contact us at info@selfcraftpartners.com and we will delete it promptly.

## 9. Changes to this policy

We may update this Privacy Policy from time to time. When we do, we will update the "Last updated" date at the top of this page and, for material changes, notify you by email. Continued use of Gravitas after a policy update constitutes your acceptance of the new terms.

## 10. Contact

For any privacy-related questions, data subject access requests, or complaints, contact our privacy team at info@selfcraftpartners.com.

---

# Appendix B — Terms of Service

*Version 2.0, last updated 28 August 2026*

## 1. Acceptance of terms

By creating an account on Gravitas AI ("Gravitas", "we", "us", "our"), you agree to be bound by these Terms of Service and our Privacy Policy. If you do not agree to these terms, do not use the service.

## 2. Description of service

**Trial / demonstration service.** Gravitas is currently made available on a trial and demonstration basis, for evaluation purposes only. It is not intended for business-critical, high-stakes, or reliance use of any kind, and is not a substitute for professional coaching, psychological, medical, or career advice. You use the Service entirely at your own risk.

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

To the fullest extent permitted by law, the Service — including all content, features, scoring, and outputs — is provided strictly "as is" and "as available", without warranties of any kind, whether express, implied, or statutory, including without limitation implied warranties of merchantability, fitness for a particular purpose, accuracy, reliability, uninterrupted operation, or non-infringement. We do not warrant that the Service will be uninterrupted, secure, timely, or error-free, or that any defects will be corrected.

## 7a. Scheduled sessions and availability

Where you plan to use Gravitas at a specific date or time, we will use reasonable efforts to ensure the Service is available but cannot guarantee that the Service, or any third-party provider it depends on (see Section 8), will be available or fully operational at that time. We recommend building reasonable buffer time into time-sensitive plans. Gravitas does not accept liability for costs, damages, or reputational harm arising from third-party service unavailability during a planned session.

## 8. AI-generated content

Coaching feedback and scores generated by Gravitas are produced by artificial intelligence and are for informational and developmental purposes only. They do not constitute professional advice. Gravitas makes no warranties about the accuracy or completeness of AI-generated feedback. You should not rely solely on Gravitas feedback for important professional decisions. Gravitas does not guarantee any specific outcome, including but not limited to improved performance evaluations, interview success, promotion, or academic results.

Gravitas relies on third-party artificial intelligence providers (including but not limited to Anthropic and OpenAI) to process recordings and generate feedback. The availability, performance, and accuracy of the Service depend on the continued availability and performance of these third-party providers. Gravitas does not control and is not responsible for outages, degraded performance, model changes, or service interruptions caused by third-party AI providers. In the event of such a disruption, you may experience delays, incomplete results, or temporary unavailability of the Service.

## 9. Intellectual property

All intellectual property in the Gravitas platform, including its design, scoring methodology, software, and content (excluding your personal data), is owned by Gravitas AI. You are granted a limited, non-transferable licence to use the platform for personal professional development. Nothing in these terms transfers any intellectual property rights to you.

## 10. Limitation of liability

To the maximum extent permitted by applicable law, Gravitas AI shall not be liable for any indirect, incidental, special, consequential, exemplary, or punitive damages of any kind, including loss of profits, revenue, business, goodwill, reputation, or data, arising from your use of, or inability to use, the service, however caused and under any theory of liability (including contract, tort, and negligence), even if Gravitas has been advised of the possibility of such damages.

Our total aggregate liability to you for any and all claims arising out of or relating to these Terms or the Service shall not exceed the total subscription fees paid by you to Gravitas in the 12 months preceding the claim. Where you have accessed the Service under a free trial, demonstration, or Beta account without a paid subscription, our total liability to you is limited to zero (0).

Gravitas shall not be liable for any failure or delay in performance resulting from causes beyond its reasonable control, including but not limited to failure or unavailability of third-party AI models, cloud infrastructure, or internet service providers, cyberattacks, denial-of-service attacks, security incidents, or other events beyond its reasonable control.

Nothing in these Terms limits or excludes liability that cannot be limited or excluded under applicable law, including liability for death or personal injury caused by negligence, or for fraud.

## 10a. Data security and cyber incidents

Gravitas implements reasonable technical and organisational measures designed to protect your data, as described in our Privacy Policy. No method of transmission or storage is completely secure, and we cannot guarantee the absolute security of your data. In the event of a security incident, data breach, or unauthorised access affecting your data, Gravitas's obligations are limited to those required by applicable data protection law (including notifying affected individuals and/or regulators where required). To the maximum extent permitted by law, Gravitas excludes all liability for any loss, damage, or expense arising from such an incident, including where it results from the acts or omissions of a third party, a third-party service provider (including but not limited to our AI, hosting, or database providers), or a cyberattack.

## 10b. Indemnification

You agree to indemnify, defend, and hold harmless Gravitas AI and its founders, employees, and personnel from and against any claims, damages, losses, liabilities, costs, and expenses (including reasonable legal fees) arising out of or relating to: (a) your breach of these Terms; (b) your misuse of the Service; (c) any content or recordings you submit, including recordings of third parties submitted without their consent; or (d) your violation of any applicable law or the rights of any third party.

## 11. Termination

You may delete your account at any time from Account Settings. We may suspend, restrict, or terminate your account or access to the Service, in whole or in part, at any time and with or without notice, including if you violate these terms or during the trial/demonstration period. Upon termination, your right to use the service ceases immediately. Gravitas is not liable to you or any third party for any suspension, restriction, or discontinuation of the Service.

## 12. Changes to terms

We may update these terms from time to time. We will notify you of material changes by email. Continued use of the service after the effective date of changes constitutes acceptance of the new terms.

## 13. Governing law

These Terms are governed by and construed in accordance with the laws of the Province of Ontario and the federal laws of Canada applicable therein, without regard to conflict of law principles. You and Gravitas each irrevocably submit to the exclusive jurisdiction of the courts of Ontario, Canada, for any dispute arising out of or relating to these Terms or the Service. If you are a consumer resident in a jurisdiction that grants you the benefit of mandatory local consumer protection laws that cannot be excluded by agreement, nothing in this section removes those protections.

## 14. Contact

For questions about these Terms of Service, contact us at info@selfcraftpartners.com.

**Document ends.**
