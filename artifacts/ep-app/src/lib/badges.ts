export type BadgeCategory = "identity" | "reps" | "earned";

export interface BadgeDefinition {
  id: string;
  name: string;
  category: BadgeCategory;
  revealCopy: string;
  description: string;
  sessionThreshold?: number;
  scoreThreshold?: number;
}

export const ARENA_BADGE: BadgeDefinition = {
  id: "arena",
  name: "The Arena",
  category: "identity",
  sessionThreshold: 1,
  description: "Unlocked on your first session. You chose to see yourself as others do — that takes courage most people avoid.",
  revealCopy: "You chose to see yourself clearly. That's where it begins.",
};

export const REP_BADGES: BadgeDefinition[] = [
  { id: "rep3",  name: "3 Reps",  category: "reps", sessionThreshold: 3,  description: "Unlocked at 3 sessions. The habit is starting to form.", revealCopy: "Three sessions. The habit is forming." },
  { id: "rep5",  name: "5 Reps",  category: "reps", sessionThreshold: 5,  description: "Unlocked at 5 sessions. You're showing up consistently.", revealCopy: "Five sessions in. You're doing the work." },
  { id: "rep10", name: "10 Reps", category: "reps", sessionThreshold: 10, description: "Unlocked at 10 sessions. Most people never get this far.", revealCopy: "Ten reps. Most people never get here." },
  { id: "rep25", name: "25 Reps", category: "reps", sessionThreshold: 25, description: "Unlocked at 25 sessions. This is what sustained commitment looks like.", revealCopy: "Twenty-five sessions. This is what sustained commitment looks like." },
  { id: "rep50", name: "50 Reps", category: "reps", sessionThreshold: 50, description: "Unlocked at 50 sessions. You didn't just start — you stayed.", revealCopy: "Fifty. You didn't just start — you stayed." },
];

export const BREAKTHROUGH_BADGE: BadgeDefinition = {
  id: "breakthrough",
  name: "Breakthrough",
  category: "earned",
  scoreThreshold: 6.5,
  description: "Earned the first time you scored 6.5 or above. Something clicked.",
  revealCopy: "You broke through. Your first session above 6.5.",
};

export const DISTINGUISHED_BADGE: BadgeDefinition = {
  id: "distinguished",
  name: "Distinguished",
  category: "earned",
  scoreThreshold: 8.5,
  description: "Earned the first time you scored 8.5 or above — the highest tier in Gravitas.",
  revealCopy: "Distinguished. The highest tier. You earned it.",
};

// Stone fill darkens with each rep milestone
export function repFill(sessionThreshold: number): string {
  if (sessionThreshold <= 3)  return "#78716C";
  if (sessionThreshold <= 5)  return "#6B6460";
  if (sessionThreshold <= 10) return "#5C5350";
  if (sessionThreshold <= 25) return "#4A4340";
  return "#292524";
}

// All badges earned by this session (0–2). Returned in display order: earned first, rep second.
// sortedSessions: all completed sessions sorted oldest → newest.
export function computeSessionBadges(
  sortedSessions: Array<{ id: string; compositeScore?: string | null }>,
  currentSessionId: string,
  currentScore: number | null,
): BadgeDefinition[] {
  const idx = sortedSessions.findIndex(s => s.id === currentSessionId);
  if (idx < 0) return [];

  const sessionNumber = idx + 1;
  const prev = sortedSessions.slice(0, idx);
  const badges: BadgeDefinition[] = [];

  // Session 1: The Arena only (baseline — suppress score badges)
  if (sessionNumber === 1) return [ARENA_BADGE];

  // Score-based badges (Distinguished XOR Breakthrough — Distinguished implies Breakthrough)
  if (currentScore !== null) {
    const prevMax = prev.reduce((max, s) => Math.max(max, parseFloat(s.compositeScore ?? "0")), 0);
    if (currentScore >= 8.5 && prevMax < 8.5) badges.push(DISTINGUISHED_BADGE);
    else if (currentScore >= 6.5 && prevMax < 6.5) badges.push(BREAKTHROUGH_BADGE);
  }

  // Rep milestone (can stack with a score badge)
  const repBadge = REP_BADGES.find(b => b.sessionThreshold === sessionNumber);
  if (repBadge) badges.push(repBadge);

  return badges;
}

// Most prestigious badge earned overall — for dashboard display.
export function computeHighestBadge(
  completed: Array<{ compositeScore?: string | null }>,
): BadgeDefinition | null {
  if (completed.length === 0) return null;
  const maxScore = completed.reduce((m, s) => Math.max(m, parseFloat(s.compositeScore ?? "0")), 0);
  if (maxScore >= 8.5) return DISTINGUISHED_BADGE;
  if (maxScore >= 6.5) return BREAKTHROUGH_BADGE;
  const repBadge = [...REP_BADGES].reverse().find(b => completed.length >= (b.sessionThreshold ?? 0));
  return repBadge ?? ARENA_BADGE;
}
