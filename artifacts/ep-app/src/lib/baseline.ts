export const BASELINE_PROMPTS = {
  interview: {
    prompt: "Tell me about yourself.",
    instruction: "Take 30 seconds to think and structure your thoughts in your mind. Do not script it. Then speak as if you are opening a real interview. This is your starting point — not a test.",
    duration: "90 seconds recommended",
  },
  workplace: {
    prompt: "Walk me through a project you're currently working on and why it matters.",
    instruction: "Take 30 seconds to think and structure your thoughts in your mind. Do not script it. Speak as if you are briefing a senior leader. This is your starting point — not a test.",
    duration: "90 seconds recommended",
  },
};

interface BaselineUser {
  totalRecordingSeconds?: number;
  primaryGoal?: string | null;
  interviewMode?: boolean | null;
}

// Any "Record" entry point should route first-time users into the baseline
// prompt instead of the blank recorder, so their first session matches what
// onboarding would have sent them to.
export function getRecordHref(user: BaselineUser | null | undefined): string {
  if (!user || (user.totalRecordingSeconds ?? 0) > 0) return "/record";

  const path =
    user.primaryGoal === "interview_prep" ? "interview"
    : user.primaryGoal === "workplace_presence" ? "workplace"
    : user.interviewMode ? "interview"
    : null;

  if (!path) return "/record";

  const bp = BASELINE_PROMPTS[path];
  return `/record?baseline=1&prompt=${encodeURIComponent(bp.prompt)}&instruction=${encodeURIComponent(bp.instruction)}&duration=${encodeURIComponent(bp.duration)}`;
}
