export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-[#FBF7F2] py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="mb-10">
          <h1
            className="text-4xl font-semibold text-[#0F1B2D] mb-2"
            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
          >
            Privacy Policy
          </h1>
          <p className="text-sm text-gray-500">Last updated: 25 June 2026 — Version 1.0</p>
        </div>

        <div className="prose prose-sm max-w-none text-[#0F1B2D] space-y-8">

          <section>
            <h2 className="text-lg font-semibold mb-2">1. Who we are</h2>
            <p className="text-gray-700 leading-relaxed">
              Gravitas AI ("Gravitas", "we", "us", "our") is the data controller for personal data processed through this platform. If you have any questions about how we handle your data, please contact us at{" "}
              <a href="mailto:privacy@gravitas.ai" className="text-[#C84A18] underline">privacy@gravitas.ai</a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">2. What data we collect and why</h2>
            <div className="space-y-4 text-gray-700 leading-relaxed">
              <div>
                <h3 className="font-medium text-[#0F1B2D] mb-1">Account information</h3>
                <p>Your name, email address, and password (stored as a secure hash). We need this to create and manage your account. Legal basis: contract performance (Article 6(1)(b) GDPR).</p>
              </div>
              <div>
                <h3 className="font-medium text-[#0F1B2D] mb-1">Professional profile</h3>
                <p>Career stage, work experience, role title, goals, industry, and interview details you provide during onboarding. We use this to personalise your coaching experience. Legal basis: contract performance and your consent.</p>
              </div>
              <div>
                <h3 className="font-medium text-[#0F1B2D] mb-1">Voice and video recordings</h3>
                <p>
                  When you submit a practice session, we process your audio recording and (for video sessions) video frames. These are used solely to analyse your communication and provide coaching feedback. <strong>We do not permanently store your audio files or video recordings.</strong> They are processed in memory and immediately discarded after analysis.
                </p>
                <p className="mt-1">Legal basis: your explicit consent (Article 6(1)(a) and Article 9(2)(a) GDPR for biometric data).</p>
              </div>
              <div>
                <h3 className="font-medium text-[#0F1B2D] mb-1">Transcripts and session feedback</h3>
                <p>A text transcript of your speech and the AI-generated coaching feedback from each session are stored in our database. These are linked to your account and enable you to review your progress over time. Legal basis: contract performance.</p>
              </div>
              <div>
                <h3 className="font-medium text-[#0F1B2D] mb-1">Performance metrics</h3>
                <p>Quantitative data derived from your sessions — such as speech rate, filler word frequency, pausing patterns, vocal characteristics, and eye contact rate. These are stored as part of your session record. Legal basis: contract performance.</p>
              </div>
              <div>
                <h3 className="font-medium text-[#0F1B2D] mb-1">Consent record</h3>
                <p>The timestamp and version of this Privacy Policy you accepted when creating your account. We store this to demonstrate your consent. Legal basis: legal obligation (Article 6(1)(c) GDPR).</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">3. Who we share your data with</h2>
            <p className="text-gray-700 leading-relaxed mb-3">
              We share limited data with the following third-party service providers in order to deliver the Gravitas service. Each is bound by data processing agreements.
            </p>
            <div className="space-y-4 text-gray-700 leading-relaxed">
              <div>
                <h3 className="font-medium text-[#0F1B2D] mb-1">OpenAI (United States)</h3>
                <p>Your audio recording is sent to OpenAI's API for speech-to-text transcription. Your voice is biometric data under GDPR. OpenAI may retain audio for up to 30 days for abuse prevention purposes in accordance with their data retention policy. We rely on Standard Contractual Clauses (SCCs) for this international data transfer.</p>
              </div>
              <div>
                <h3 className="font-medium text-[#0F1B2D] mb-1">Anthropic (United States)</h3>
                <p>Your session transcript, coaching context (role, goals, industry), and video frames (for video sessions) are sent to Anthropic's Claude API for AI-powered coaching analysis and scoring. Anthropic does not train on API data by default. We rely on Standard Contractual Clauses (SCCs) for this international data transfer.</p>
              </div>
              <div>
                <h3 className="font-medium text-[#0F1B2D] mb-1">Resend (email delivery)</h3>
                <p>Your email address and name are shared with Resend to deliver transactional emails (account verification, password reset). Resend is GDPR-compliant and does not use your data for marketing.</p>
              </div>
              <div>
                <h3 className="font-medium text-[#0F1B2D] mb-1">Supabase (database hosting, EU)</h3>
                <p>Your data is stored on PostgreSQL databases hosted by Supabase in the EU (Frankfurt, Germany). Supabase is GDPR-compliant and your data remains within the EU.</p>
              </div>
            </div>
            <p className="text-gray-700 leading-relaxed mt-3">
              We do not sell your data to any third party. We do not use your data for advertising.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">4. How long we keep your data</h2>
            <div className="space-y-2 text-gray-700 leading-relaxed">
              <p><strong>Active accounts:</strong> We keep your account data and session history for as long as your account is active. Tracking your progress over time is a core purpose of the service, so we retain your session history to show you long-term improvement. You can delete individual sessions or all data at any time from your account settings.</p>
              <p><strong>Audio and video:</strong> Not stored — deleted immediately after processing (typically within seconds).</p>
              <p><strong>Deleted accounts:</strong> When you delete your account, it is immediately deactivated and all personal data — including your profile, session transcripts, scores, and performance metrics — is permanently and irreversibly erased within 30 days. You will receive a reminder email 7 days before the final deletion, with a link to restore your account if you change your mind.</p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">5. Your rights under GDPR</h2>
            <p className="text-gray-700 leading-relaxed mb-3">If you are located in the European Economic Area or UK, you have the following rights:</p>
            <div className="space-y-2 text-gray-700 leading-relaxed">
              <p><strong>Right of access:</strong> You can download a copy of all data we hold about you from your Account Settings page.</p>
              <p><strong>Right to rectification:</strong> You can update your profile information at any time in Account Settings.</p>
              <p><strong>Right to erasure:</strong> You can delete your account and all associated data from Account Settings. We will permanently erase everything within 30 days.</p>
              <p><strong>Right to portability:</strong> Your data export (available in Settings) is provided in JSON format, which can be read by any standard tool.</p>
              <p><strong>Right to object:</strong> You may object to processing based on legitimate interests. Contact us at privacy@gravitas.ai.</p>
              <p><strong>Right to withdraw consent:</strong> Where we process data based on your consent (audio, video, biometric metrics), you may withdraw consent at any time by deleting your account. Withdrawal does not affect the lawfulness of processing before withdrawal.</p>
              <p><strong>Right to lodge a complaint:</strong> You have the right to lodge a complaint with your national data protection supervisory authority.</p>
            </div>
            <p className="text-gray-700 leading-relaxed mt-3">
              To exercise any of these rights, contact us at{" "}
              <a href="mailto:privacy@gravitas.ai" className="text-[#C84A18] underline">privacy@gravitas.ai</a>.
              We will respond within 30 days.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">6. Data security</h2>
            <p className="text-gray-700 leading-relaxed">
              We use industry-standard security measures including encrypted connections (TLS), secure password hashing (bcrypt), and access controls. Your data is stored in EU-based infrastructure. However, no system is 100% secure and we cannot guarantee absolute security of your data.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">7. Cookies</h2>
            <p className="text-gray-700 leading-relaxed">
              Gravitas uses only essential functional cookies required to keep you logged in. We do not use advertising, analytics, or tracking cookies. No cookie consent banner is required for strictly necessary cookies under GDPR.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">8. Children</h2>
            <p className="text-gray-700 leading-relaxed">
              Gravitas is not directed at children under 16. We do not knowingly collect personal data from anyone under 16. If you believe a child has provided us with personal data, please contact us at privacy@gravitas.ai and we will delete it promptly.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">9. Changes to this policy</h2>
            <p className="text-gray-700 leading-relaxed">
              We may update this Privacy Policy from time to time. When we do, we will update the "Last updated" date at the top of this page and, for material changes, notify you by email. Continued use of Gravitas after a policy update constitutes your acceptance of the new terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">10. Contact</h2>
            <p className="text-gray-700 leading-relaxed">
              For any privacy-related questions, data subject access requests, or complaints, contact our privacy team at{" "}
              <a href="mailto:privacy@gravitas.ai" className="text-[#C84A18] underline">privacy@gravitas.ai</a>.
            </p>
          </section>

        </div>

        <div className="mt-12 pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-400 text-center">
            Gravitas AI · Privacy Policy v1.0 · Last updated 25 June 2026
          </p>
        </div>
      </div>
    </div>
  );
}
