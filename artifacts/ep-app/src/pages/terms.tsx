export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#FBF7F2] py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="mb-10">
          <h1
            className="text-4xl font-semibold text-[#0F1B2D] mb-2"
            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
          >
            Terms of Service
          </h1>
          <p className="text-sm text-gray-500">Last updated: 28 August 2026 — Version 2.0</p>
        </div>

        <div className="prose prose-sm max-w-none text-[#0F1B2D] space-y-8">

          <section>
            <h2 className="text-lg font-semibold mb-2">1. Acceptance of terms</h2>
            <p className="text-gray-700 leading-relaxed">
              By creating an account on Gravitas AI ("Gravitas", "we", "us", "our"), you agree to be bound by these Terms of Service and our{" "}
              <a href="/privacy" className="text-[#C84A18] underline">Privacy Policy</a>. If you do not agree to these terms, do not use the service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">2. Description of service</h2>
            <div className="space-y-2 text-gray-700 leading-relaxed">
              <p className="rounded-lg border border-[#C84A18]/30 bg-[#C84A18]/5 px-4 py-3">
                <strong className="text-[#0F1B2D]">Trial / demonstration service.</strong> Gravitas is currently made available on a trial and demonstration basis, for evaluation purposes only. It is not intended for business-critical, high-stakes, or reliance use of any kind, and is not a substitute for professional coaching, psychological, medical, or career advice. You use the Service entirely at your own risk.
              </p>
              <p>
                Gravitas is an AI-powered communication coaching platform that analyses voice and video recordings to provide feedback on executive presence, communication effectiveness, and delivery. The platform is currently in Beta and is provided for personal professional development purposes.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">3. Eligibility</h2>
            <p className="text-gray-700 leading-relaxed">
              You must be at least 16 years old to use Gravitas. By creating an account, you confirm you meet this age requirement. Gravitas is intended for individual professional use, not for commercial resale or redistribution.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">4. Your account</h2>
            <div className="space-y-2 text-gray-700 leading-relaxed">
              <p>You are responsible for maintaining the confidentiality of your account credentials. You must notify us immediately at{" "}
                <a href="mailto:info@selfcraftpartners.com" className="text-[#C84A18] underline">info@selfcraftpartners.com</a>{" "}
                if you suspect unauthorised access to your account.
              </p>
              <p>You are responsible for all activity that occurs under your account. You may not share your account with others or create accounts on behalf of third parties without their consent.</p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">5. Recordings and content</h2>
            <div className="space-y-2 text-gray-700 leading-relaxed">
              <p>When you submit a recording, you grant Gravitas a limited, non-exclusive licence to process that recording solely for the purpose of providing coaching analysis and feedback to you. We do not use your recordings to train AI models.</p>
              <p>You must not submit recordings containing third parties without their consent. You must not submit recordings containing sensitive information about others (e.g., confidential business information, other people's private details).</p>
              <p>You retain all rights to content you create. Gravitas retains the analysis and feedback derived from your content as part of your account.</p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">6. Acceptable use</h2>
            <p className="text-gray-700 leading-relaxed mb-2">You agree not to:</p>
            <ul className="list-disc list-inside space-y-1 text-gray-700 ml-2">
              <li>Use Gravitas for any unlawful purpose</li>
              <li>Attempt to reverse-engineer, scrape, or copy the platform</li>
              <li>Submit content that is abusive, defamatory, or violates the rights of others</li>
              <li>Use automated tools to access the platform without our written permission</li>
              <li>Attempt to circumvent security or access controls</li>
              <li>Resell or sublicence access to the platform</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">7. Beta service</h2>
            <div className="space-y-2 text-gray-700 leading-relaxed">
              <p>Gravitas is currently in Beta. This means the service may be unstable, contain bugs, or change significantly. We provide the Beta service "as is" and make no guarantees about its availability, accuracy, or fitness for any particular purpose. Feedback you provide during Beta may be used to improve the service.</p>
              <p>Our scoring methodology, dimensions, and criteria may be updated, recalibrated, or changed over time as the service evolves. Scores and feedback generated at different points in time, or under different methodology versions, may not be directly comparable.</p>
              <p>To the fullest extent permitted by law, the Service — including all content, features, scoring, and outputs — is provided strictly "as is" and "as available", without warranties of any kind, whether express, implied, or statutory, including without limitation implied warranties of merchantability, fitness for a particular purpose, accuracy, reliability, uninterrupted operation, or non-infringement. We do not warrant that the Service will be uninterrupted, secure, timely, or error-free, or that any defects will be corrected.</p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">7a. Scheduled sessions and availability</h2>
            <p className="text-gray-700 leading-relaxed">
              Where you plan to use Gravitas at a specific date or time, we will use reasonable efforts to ensure the Service is available but cannot guarantee that the Service, or any third-party provider it depends on (see Section 8), will be available or fully operational at that time. We recommend building reasonable buffer time into time-sensitive plans. Gravitas does not accept liability for costs, damages, or reputational harm arising from third-party service unavailability during a planned session.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">8. AI-generated content</h2>
            <div className="space-y-2 text-gray-700 leading-relaxed">
              <p>Coaching feedback and scores generated by Gravitas are produced by artificial intelligence and are for informational and developmental purposes only. They do not constitute professional advice. Gravitas makes no warranties about the accuracy or completeness of AI-generated feedback. You should not rely solely on Gravitas feedback for important professional decisions. Gravitas does not guarantee any specific outcome, including but not limited to improved performance evaluations, interview success, promotion, or academic results.</p>
              <p>Gravitas relies on third-party artificial intelligence providers (including but not limited to Anthropic and OpenAI) to process recordings and generate feedback. The availability, performance, and accuracy of the Service depend on the continued availability and performance of these third-party providers. Gravitas does not control and is not responsible for outages, degraded performance, model changes, or service interruptions caused by third-party AI providers. In the event of such a disruption, you may experience delays, incomplete results, or temporary unavailability of the Service.</p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">9. Intellectual property</h2>
            <p className="text-gray-700 leading-relaxed">
              All intellectual property in the Gravitas platform, including its design, scoring methodology, software, and content (excluding your personal data), is owned by Gravitas AI. You are granted a limited, non-transferable licence to use the platform for personal professional development. Nothing in these terms transfers any intellectual property rights to you.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">10. Limitation of liability</h2>
            <div className="space-y-2 text-gray-700 leading-relaxed">
              <p>To the maximum extent permitted by applicable law, Gravitas AI shall not be liable for any indirect, incidental, special, consequential, exemplary, or punitive damages of any kind, including loss of profits, revenue, business, goodwill, reputation, or data, arising from your use of, or inability to use, the service, however caused and under any theory of liability (including contract, tort, and negligence), even if Gravitas has been advised of the possibility of such damages.</p>
              <p>Our total aggregate liability to you for any and all claims arising out of or relating to these Terms or the Service shall not exceed the total subscription fees paid by you to Gravitas in the 12 months preceding the claim. Where you have accessed the Service under a free trial, demonstration, or Beta account without a paid subscription, our total liability to you is limited to zero (0).</p>
              <p>Gravitas shall not be liable for any failure or delay in performance resulting from causes beyond its reasonable control, including but not limited to failure or unavailability of third-party AI models, cloud infrastructure, or internet service providers, cyberattacks, denial-of-service attacks, security incidents, or other events beyond its reasonable control.</p>
              <p>Nothing in these Terms limits or excludes liability that cannot be limited or excluded under applicable law, including liability for death or personal injury caused by negligence, or for fraud.</p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">10a. Data security and cyber incidents</h2>
            <p className="text-gray-700 leading-relaxed">
              Gravitas implements reasonable technical and organisational measures designed to protect your data, as described in our{" "}
              <a href="/privacy" className="text-[#C84A18] underline">Privacy Policy</a>. No method of transmission or storage is completely secure, and we cannot guarantee the absolute security of your data. In the event of a security incident, data breach, or unauthorised access affecting your data, Gravitas's obligations are limited to those required by applicable data protection law (including notifying affected individuals and/or regulators where required). To the maximum extent permitted by law, Gravitas excludes all liability for any loss, damage, or expense arising from such an incident, including where it results from the acts or omissions of a third party, a third-party service provider (including but not limited to our AI, hosting, or database providers), or a cyberattack.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">10b. Indemnification</h2>
            <p className="text-gray-700 leading-relaxed">
              You agree to indemnify, defend, and hold harmless Gravitas AI and its founders, employees, and personnel from and against any claims, damages, losses, liabilities, costs, and expenses (including reasonable legal fees) arising out of or relating to: (a) your breach of these Terms; (b) your misuse of the Service; (c) any content or recordings you submit, including recordings of third parties submitted without their consent; or (d) your violation of any applicable law or the rights of any third party.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">11. Termination</h2>
            <p className="text-gray-700 leading-relaxed">
              You may delete your account at any time from Account Settings. We may suspend, restrict, or terminate your account or access to the Service, in whole or in part, at any time and with or without notice, including if you violate these terms or during the trial/demonstration period. Upon termination, your right to use the service ceases immediately. Gravitas is not liable to you or any third party for any suspension, restriction, or discontinuation of the Service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">12. Changes to terms</h2>
            <p className="text-gray-700 leading-relaxed">
              We may update these terms from time to time. We will notify you of material changes by email. Continued use of the service after the effective date of changes constitutes acceptance of the new terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">13. Governing law</h2>
            <p className="text-gray-700 leading-relaxed">
              These Terms are governed by and construed in accordance with the laws of the Province of Ontario and the federal laws of Canada applicable therein, without regard to conflict of law principles. You and Gravitas each irrevocably submit to the exclusive jurisdiction of the courts of Ontario, Canada, for any dispute arising out of or relating to these Terms or the Service. If you are a consumer resident in a jurisdiction that grants you the benefit of mandatory local consumer protection laws that cannot be excluded by agreement, nothing in this section removes those protections.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">14. Contact</h2>
            <p className="text-gray-700 leading-relaxed">
              For questions about these Terms of Service, contact us at{" "}
              <a href="mailto:info@selfcraftpartners.com" className="text-[#C84A18] underline">info@selfcraftpartners.com</a>.
            </p>
          </section>

        </div>

        <div className="mt-12 pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-400 text-center">
            Gravitas AI · Terms of Service v2.0 · Last updated 28 August 2026
          </p>
        </div>
      </div>
    </div>
  );
}
