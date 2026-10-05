// Remembers which landing page a visitor came from, so signed-out screens and
// onboarding can match it. Stored in the browser only: if the verification email
// is opened on another device the flag is absent and everything falls back to
// the normal flow (including the "what brings you here" question).
const ENTRY_KEY = "gravitas_entry";

export const INTERVIEW_TAGLINE = "Walk in prepared. Speak with presence.";
export const DEFAULT_TAGLINE = "Executive Presence, Elevated.";

export function isInterviewEntry(): boolean {
  try { return localStorage.getItem(ENTRY_KEY) === "interview"; } catch { return false; }
}

export function setInterviewEntry() {
  try { localStorage.setItem(ENTRY_KEY, "interview"); } catch {}
}

export function clearEntry() {
  try { localStorage.removeItem(ENTRY_KEY); } catch {}
}

export function signedOutTagline(): string {
  return isInterviewEntry() ? INTERVIEW_TAGLINE : DEFAULT_TAGLINE;
}
