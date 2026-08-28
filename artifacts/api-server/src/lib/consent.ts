// Single source of truth for the Privacy Policy / Terms versions users must
// have accepted. Bump either constant whenever the published document changes
// materially — every response that includes a user object recomputes
// `needsConsent` against them, so existing users are re-gated automatically
// rather than only users who have never consented at all.
export const CURRENT_PRIVACY_POLICY_VERSION = "1.1";
export const CURRENT_TERMS_VERSION = "2.0";

export function computeNeedsConsent(user: { privacyPolicyVersion: string | null; termsVersion: string | null }): boolean {
  return (
    user.privacyPolicyVersion !== CURRENT_PRIVACY_POLICY_VERSION ||
    user.termsVersion !== CURRENT_TERMS_VERSION
  );
}
