import { Router } from "express";
import { requireAuth } from "../lib/auth.js";

// Which structural yardstick the scoring model should hold this prompt to on
// the structure dimension. Prompt category alone is not a reliable signal —
// e.g. "Motivation" and "Influence" appear in both a retrospective story
// ("tell me about a time you influenced someone") and a live, present-tense
// ask ("make cross-team cooperation happen") — so this is tagged explicitly
// per prompt rather than derived from category or free-text pattern matching.
//
// - story:          retrospective behavioural answer (STAR/SCR); a missing
//                    result is a real gap.
// - narrative:       self-introduction / background walkthrough; expects a
//                    Past → Present → Future arc with a forward-looking
//                    close, not a resolved outcome.
// - vision:          future-facing aspiration; a forward-looking goal
//                    statement IS the correct close — do not demand a
//                    completed proof point.
// - rationale:       direct-answer / self-assessment question (motivation,
//                    weakness, opinion); PREP-style point-first reasoning is
//                    expected, not STAR/SCR.
// - recommendation:  live communication of a decision, update, pitch, or
//                    pushback; SCR/Pyramid resolution is genuinely expected.
// - resilience:      an ongoing response to a recent setback; "what I'm
//                    doing about it now" is a valid close — a fully resolved
//                    happy outcome should not be demanded.
// - inspiration:     a rallying/motivational address; expects an emotional
//                    throughline and a call to action, not SCR.
export type StructureFamily =
  | "story"
  | "narrative"
  | "vision"
  | "rationale"
  | "recommendation"
  | "resilience"
  | "inspiration";

export interface Prompt {
  id: string;
  category: string;
  context: string;
  text: string;
  recommendedDurationSeconds: number;
  sector?: string;
  structureFamily: StructureFamily;
}

export const PROMPTS: Prompt[] = [

  // ── WORKPLACE PROMPTS ─────────────────────────────────────────────────────

  {
    id: "W1",
    structureFamily: "narrative",
    category: "Introduction",
    context: "Stakeholder Update",
    text: "Introduce yourself to a new team or stakeholder group. Establish who you are, what you bring, and why it matters to them.",
    recommendedDurationSeconds: 60,
  },
  {
    id: "W2",
    structureFamily: "narrative",
    category: "Introduction",
    context: "Stakeholder Update",
    text: "You are at a senior professional event. Someone asks what you do. Make it memorable in under a minute.",
    recommendedDurationSeconds: 60,
  },
  {
    id: "W3",
    structureFamily: "narrative",
    category: "Introduction",
    context: "Stakeholder Update",
    text: "You are meeting a new client for the first time. Introduce yourself and establish your credibility without overselling.",
    recommendedDurationSeconds: 60,
  },
  {
    id: "W4",
    structureFamily: "recommendation",
    category: "Persuasion",
    context: "Formal Presentation",
    text: "Make the case to a sceptical senior leader for a resource, investment, or change your work requires.",
    recommendedDurationSeconds: 90,
  },
  {
    id: "W5",
    structureFamily: "recommendation",
    category: "Persuasion",
    context: "Formal Presentation",
    text: "Pitch an idea you believe in to a room that has not asked for it and may push back.",
    recommendedDurationSeconds: 90,
  },
  {
    id: "W6",
    structureFamily: "recommendation",
    category: "Persuasion",
    context: "Stakeholder Update",
    text: "Make the case for why you should lead an upcoming high-visibility opportunity.",
    recommendedDurationSeconds: 90,
  },
  {
    id: "W7",
    structureFamily: "recommendation",
    category: "Persuasion",
    context: "Stakeholder Update",
    text: "Someone whose support you need is not yet convinced by your approach. Bring them along — without authority, without pressure.",
    recommendedDurationSeconds: 90,
  },
  {
    id: "W8",
    structureFamily: "vision",
    category: "Vision",
    context: "Formal Presentation",
    text: "Describe what success looks like in your current role or team in three years — for you, for the people around you, and for the organisation.",
    recommendedDurationSeconds: 120,
  },
  {
    id: "W9",
    structureFamily: "vision",
    category: "Vision",
    context: "Stakeholder Update",
    text: "Describe where you want to be professionally in three years and what you are doing right now to get there.",
    recommendedDurationSeconds: 120,
  },
  {
    id: "W10",
    structureFamily: "recommendation",
    category: "Feedback",
    context: "Difficult Conversation",
    text: "Deliver constructive feedback to someone who is capable and high-performing but has missed an important commitment.",
    recommendedDurationSeconds: 90,
  },
  {
    id: "W11",
    structureFamily: "rationale",
    category: "Feedback",
    context: "Difficult Conversation",
    text: "You have just received critical feedback that stings. Respond to it out loud — show that you have heard it, processed it, and know what to do with it.",
    recommendedDurationSeconds: 90,
  },
  {
    id: "W12",
    structureFamily: "recommendation",
    category: "Difficult Conversation",
    context: "Difficult Conversation",
    text: "A colleague's behaviour in a recent meeting created a problem for the team. Raise it with them directly and constructively.",
    recommendedDurationSeconds: 90,
  },
  {
    id: "W13",
    structureFamily: "recommendation",
    category: "Difficult Conversation",
    context: "Difficult Conversation",
    text: "Push back on a decision made by someone more senior than you. Be clear, be direct, and stay respectful.",
    recommendedDurationSeconds: 90,
  },
  {
    id: "W14",
    structureFamily: "recommendation",
    category: "Difficult Conversation",
    context: "Difficult Conversation",
    text: "You need to tell someone their role is changing in a way they will not welcome. Deliver the message with clarity and care.",
    recommendedDurationSeconds: 90,
  },
  {
    id: "W15",
    structureFamily: "recommendation",
    category: "Difficult Conversation",
    context: "Difficult Conversation",
    text: "A team member is consistently underperforming. Begin the conversation that needs to happen.",
    recommendedDurationSeconds: 90,
  },
  {
    id: "W16",
    structureFamily: "recommendation",
    category: "Crisis",
    context: "Formal Presentation",
    text: "Something has gone wrong on a project or initiative you are responsible for. Address the people involved — name what happened, take accountability, and lay out what comes next.",
    recommendedDurationSeconds: 120,
  },
  {
    id: "W17",
    structureFamily: "recommendation",
    category: "Crisis",
    context: "Stakeholder Update",
    text: "A senior stakeholder has just heard about a problem before you could brief them. Get ahead of it now.",
    recommendedDurationSeconds: 90,
  },
  {
    id: "W18",
    structureFamily: "recommendation",
    category: "Data",
    context: "Formal Presentation",
    text: "Present the three most important findings from a piece of work to a leadership audience who care about implications, not methodology.",
    recommendedDurationSeconds: 90,
  },
  {
    id: "W19",
    structureFamily: "recommendation",
    category: "Data",
    context: "Stakeholder Update",
    text: "Explain a complex idea in your field to someone intelligent who knows nothing about it. Make it land in under two minutes.",
    recommendedDurationSeconds: 90,
  },
  {
    id: "W20",
    structureFamily: "recommendation",
    category: "Negotiation",
    context: "Difficult Conversation",
    text: "Negotiate a change — to scope, timeline, or terms — with someone who is resistant.",
    recommendedDurationSeconds: 90,
  },
  {
    id: "W21",
    structureFamily: "recommendation",
    category: "Negotiation",
    context: "Difficult Conversation",
    text: "Your counterpart has just pushed back hard on your position. Hold your ground without creating conflict.",
    recommendedDurationSeconds: 90,
  },
  {
    id: "W22",
    structureFamily: "inspiration",
    category: "Inspiration",
    context: "High Energy",
    text: "The quarter ahead is demanding and the team knows it. Say something that makes them want to show up fully.",
    recommendedDurationSeconds: 90,
  },
  {
    id: "W23",
    structureFamily: "recommendation",
    category: "Stakeholder Update",
    context: "Stakeholder Update",
    text: "Brief a senior stakeholder on the current status of a high-priority piece of work — include one risk you are actively managing.",
    recommendedDurationSeconds: 90,
  },
  {
    id: "W24",
    structureFamily: "recommendation",
    category: "Stakeholder Update",
    context: "Stakeholder Update",
    text: "Update a sceptical client or stakeholder on a project that has fallen behind. Be direct and maintain their confidence.",
    recommendedDurationSeconds: 90,
  },
  {
    id: "W25",
    structureFamily: "recommendation",
    category: "Stakeholder Update",
    context: "Stakeholder Update",
    text: "Update your manager on a project that has hit an unexpected obstacle. Come with the problem and a path forward.",
    recommendedDurationSeconds: 90,
  },
  {
    id: "W26",
    structureFamily: "recommendation",
    category: "Influence",
    context: "Stakeholder Update",
    text: "You need cross-team cooperation on something that is not anyone else's priority. Make the ask in a way that gets a yes.",
    recommendedDurationSeconds: 90,
  },
  {
    id: "W27",
    structureFamily: "resilience",
    category: "Resilience",
    context: "Difficult Conversation",
    text: "You have just been given a setback — a rejected proposal, a missed opportunity, a difficult outcome. Speak to what happened and what you are doing with it.",
    recommendedDurationSeconds: 90,
  },
  {
    id: "W28",
    structureFamily: "rationale",
    category: "Impromptu",
    context: "Impromptu",
    text: "A senior leader has just asked your opinion on something you were not expecting to be asked about. Give a clear, considered view in 90 seconds.",
    recommendedDurationSeconds: 90,
  },
  {
    id: "W29",
    structureFamily: "rationale",
    category: "Impromptu",
    context: "Impromptu",
    text: "You have been asked, without warning, to speak for two minutes on the biggest challenge facing your organisation or industry right now. Begin.",
    recommendedDurationSeconds: 120,
  },
  {
    id: "W30",
    structureFamily: "rationale",
    category: "Impromptu",
    context: "Impromptu",
    text: "You have 60 seconds in a lift with the most senior person in your field. Make it count.",
    recommendedDurationSeconds: 60,
  },

  // ── INTERVIEW — UNIVERSAL ─────────────────────────────────────────────────

  {
    id: "I1",
    structureFamily: "narrative",
    category: "Opening",
    context: "Impromptu",
    text: "Tell me about yourself.",
    recommendedDurationSeconds: 90,
    sector: "all",
  },
  {
    id: "I2",
    structureFamily: "narrative",
    category: "Opening",
    context: "Impromptu",
    text: "Walk me through your background and what has brought you to this point.",
    recommendedDurationSeconds: 90,
    sector: "all",
  },
  {
    id: "I3",
    structureFamily: "story",
    category: "Achievement",
    context: "Impromptu",
    text: "Tell me about your most significant professional achievement and why it stands out.",
    recommendedDurationSeconds: 120,
    sector: "all",
  },
  {
    id: "I4",
    structureFamily: "story",
    category: "Leadership",
    context: "Impromptu",
    text: "Tell me about a time you led through significant uncertainty or ambiguity.",
    recommendedDurationSeconds: 120,
    sector: "all",
  },
  {
    id: "I5",
    structureFamily: "story",
    category: "Leadership",
    context: "Impromptu",
    text: "Tell me about a time you led a team through a difficult situation with no clear playbook.",
    recommendedDurationSeconds: 120,
    sector: "all",
  },
  {
    id: "I6",
    structureFamily: "story",
    category: "Influence",
    context: "Impromptu",
    text: "Tell me about a time you had to influence someone — a peer, a senior leader, or a client — who initially did not agree with you.",
    recommendedDurationSeconds: 120,
    sector: "all",
  },
  {
    id: "I7",
    structureFamily: "story",
    category: "Failure",
    context: "Impromptu",
    text: "Tell me about a time you failed. What happened, what did you do, and what did you take from it?",
    recommendedDurationSeconds: 120,
    sector: "all",
  },
  {
    id: "I8",
    structureFamily: "story",
    category: "Conflict",
    context: "Impromptu",
    text: "Tell me about a time you had a disagreement with a colleague or manager. How did you handle it?",
    recommendedDurationSeconds: 120,
    sector: "all",
  },
  {
    id: "I9",
    structureFamily: "story",
    category: "Feedback",
    context: "Impromptu",
    text: "Tell me about a time you received critical feedback. How did you respond to it?",
    recommendedDurationSeconds: 120,
    sector: "all",
  },
  {
    id: "I10",
    structureFamily: "story",
    category: "Pressure",
    context: "Impromptu",
    text: "Tell me about a time you had to deliver something important under significant time pressure. What did you prioritise and what did you let go?",
    recommendedDurationSeconds: 120,
    sector: "all",
  },
  {
    id: "I11",
    structureFamily: "story",
    category: "Adaptability",
    context: "Impromptu",
    text: "Tell me about a time you had to adapt quickly to a significant and unexpected change.",
    recommendedDurationSeconds: 120,
    sector: "all",
  },
  {
    id: "I12",
    structureFamily: "story",
    category: "Values",
    context: "Impromptu",
    text: "Tell me about a time you had to make a decision that involved a genuine ethical or values tension. What did you do?",
    recommendedDurationSeconds: 120,
    sector: "all",
  },
  {
    id: "I13",
    structureFamily: "rationale",
    category: "Motivation",
    context: "Impromptu",
    text: "Why this organisation? Why this role? Why now?",
    recommendedDurationSeconds: 90,
    sector: "all",
  },
  {
    id: "I14",
    structureFamily: "rationale",
    category: "Weakness",
    context: "Impromptu",
    text: "What is your greatest professional weakness and what are you actively doing about it?",
    recommendedDurationSeconds: 90,
    sector: "all",
  },
  {
    id: "I15",
    structureFamily: "rationale",
    category: "AI",
    context: "Impromptu",
    text: "How do you use AI in your work? Give a specific example.",
    recommendedDurationSeconds: 90,
    sector: "all",
  },
  {
    id: "I16",
    structureFamily: "rationale",
    category: "Impromptu",
    context: "Impromptu",
    text: "You have been asked, without warning, to speak for 90 seconds on the most important lesson your career has taught you. No preparation. Begin.",
    recommendedDurationSeconds: 90,
    sector: "all",
  },

  // ── INTERVIEW — CONSULTING ────────────────────────────────────────────────

  {
    id: "C1",
    structureFamily: "rationale",
    category: "Motivation",
    context: "Impromptu",
    text: "Why consulting? Why this firm specifically? Why now in your career?",
    recommendedDurationSeconds: 90,
    sector: "consulting",
  },
  {
    id: "C2",
    structureFamily: "story",
    category: "Influence",
    context: "Impromptu",
    text: "Tell me about a time you had to persuade a sceptical senior stakeholder to accept a recommendation they initially resisted.",
    recommendedDurationSeconds: 120,
    sector: "consulting",
  },
  {
    id: "C3",
    structureFamily: "story",
    category: "Leadership",
    context: "Impromptu",
    text: "Tell me about a time you led a team through a situation with no clear precedent or playbook.",
    recommendedDurationSeconds: 120,
    sector: "consulting",
  },
  {
    id: "C4",
    structureFamily: "story",
    category: "Difficult Conversation",
    context: "Impromptu",
    text: "Tell me about a time you delivered an unpopular recommendation. How did you communicate it and handle the pushback?",
    recommendedDurationSeconds: 120,
    sector: "consulting",
  },
  {
    id: "C5",
    structureFamily: "story",
    category: "Achievement",
    context: "Impromptu",
    text: "Describe a situation where your analysis fundamentally changed the direction of a project or engagement.",
    recommendedDurationSeconds: 120,
    sector: "consulting",
  },
  {
    id: "C6",
    structureFamily: "story",
    category: "Adaptability",
    context: "Impromptu",
    text: "Tell me about a time you had to learn an unfamiliar domain quickly and still deliver meaningful work.",
    recommendedDurationSeconds: 120,
    sector: "consulting",
  },
  {
    id: "C7",
    structureFamily: "story",
    category: "Difficult Conversation",
    context: "Impromptu",
    text: "Tell me about a time you had to say no — to a client, a senior colleague, or a stakeholder — and how you handled it.",
    recommendedDurationSeconds: 120,
    sector: "consulting",
  },
  {
    id: "C8",
    structureFamily: "story",
    category: "Pressure",
    context: "Impromptu",
    text: "Tell me about a time you worked under extreme pressure to deliver a high-quality output. What trade-offs did you make?",
    recommendedDurationSeconds: 120,
    sector: "consulting",
  },
  {
    id: "C9",
    structureFamily: "story",
    category: "Failure",
    context: "Impromptu",
    text: "Tell me about a time your recommendation turned out to be wrong. How did you handle it?",
    recommendedDurationSeconds: 120,
    sector: "consulting",
  },
  {
    id: "C10",
    structureFamily: "rationale",
    category: "Weakness",
    context: "Impromptu",
    text: "What is your greatest weakness and what are you actively doing about it?",
    recommendedDurationSeconds: 90,
    sector: "consulting",
  },

  // ── INTERVIEW — BANKING & FINANCE ─────────────────────────────────────────

  {
    id: "B1",
    structureFamily: "rationale",
    category: "Motivation",
    context: "Impromptu",
    text: "Why this firm? Why this division? Why now?",
    recommendedDurationSeconds: 90,
    sector: "banking",
  },
  {
    id: "B2",
    structureFamily: "story",
    category: "Achievement",
    context: "Impromptu",
    text: "Walk me through the most commercially significant piece of work or deal you have been part of. What was at stake and what was your specific role?",
    recommendedDurationSeconds: 120,
    sector: "banking",
  },
  {
    id: "B3",
    structureFamily: "story",
    category: "Judgement",
    context: "Impromptu",
    text: "Tell me about a time you identified a significant risk or problem before others did. What did you do?",
    recommendedDurationSeconds: 120,
    sector: "banking",
  },
  {
    id: "B4",
    structureFamily: "story",
    category: "Pressure",
    context: "Impromptu",
    text: "Tell me about a time you had to maintain quality and precision under conditions that were actively working against you.",
    recommendedDurationSeconds: 120,
    sector: "banking",
  },
  {
    id: "B5",
    structureFamily: "story",
    category: "Achievement",
    context: "Impromptu",
    text: "Tell me about a time you had to stand out in an environment where everyone around you was exceptional. What did you do differently?",
    recommendedDurationSeconds: 120,
    sector: "banking",
  },
  {
    id: "B6",
    structureFamily: "story",
    category: "Communication",
    context: "Impromptu",
    text: "Tell me about a time you had to present something complex to a non-specialist audience. How did you approach it?",
    recommendedDurationSeconds: 120,
    sector: "banking",
  },
  {
    id: "B7",
    structureFamily: "story",
    category: "Conflict",
    context: "Impromptu",
    text: "Tell me about a time you disagreed with a senior person. How did you handle it?",
    recommendedDurationSeconds: 120,
    sector: "banking",
  },
  {
    id: "B8",
    structureFamily: "story",
    category: "Difficult Conversation",
    context: "Impromptu",
    text: "Tell me about a time you had to hold your position under significant pressure from someone more senior.",
    recommendedDurationSeconds: 120,
    sector: "banking",
  },
  {
    id: "B9",
    structureFamily: "story",
    category: "Pressure",
    context: "Impromptu",
    text: "Tell me about a time you had to manage multiple competing high-priority demands simultaneously. How did you decide what to do first?",
    recommendedDurationSeconds: 120,
    sector: "banking",
  },
  {
    id: "B10",
    structureFamily: "rationale",
    category: "Motivation",
    context: "Impromptu",
    text: "What is it about finance and this specific firm that brings you here?",
    recommendedDurationSeconds: 90,
    sector: "banking",
  },

  // ── INTERVIEW — TECHNOLOGY ────────────────────────────────────────────────

  {
    id: "T1",
    structureFamily: "rationale",
    category: "Motivation",
    context: "Impromptu",
    text: "Why this company? What specifically draws you here over every other option?",
    recommendedDurationSeconds: 90,
    sector: "tech",
  },
  {
    id: "T2",
    structureFamily: "story",
    category: "Ownership",
    context: "Impromptu",
    text: "Tell me about a time you took ownership of a problem that was not technically your responsibility.",
    recommendedDurationSeconds: 120,
    sector: "tech",
  },
  {
    id: "T3",
    structureFamily: "story",
    category: "Influence",
    context: "Impromptu",
    text: "Tell me about a time you had to influence a major decision without formal authority. How did you get buy-in?",
    recommendedDurationSeconds: 120,
    sector: "tech",
  },
  {
    id: "T4",
    structureFamily: "story",
    category: "Data",
    context: "Impromptu",
    text: "Tell me about a time you used data to drive a significant decision or fundamentally change a direction.",
    recommendedDurationSeconds: 120,
    sector: "tech",
  },
  {
    id: "T5",
    structureFamily: "story",
    category: "Judgement",
    context: "Impromptu",
    text: "Tell me about a time you made a call with significant uncertainty and no consensus around you. How did you decide and how did you communicate it?",
    recommendedDurationSeconds: 120,
    sector: "tech",
  },
  {
    id: "T6",
    structureFamily: "story",
    category: "Adaptability",
    context: "Impromptu",
    text: "Tell me about a time you shipped something quickly and then iterated based on real feedback. What changed and what did you learn?",
    recommendedDurationSeconds: 120,
    sector: "tech",
  },
  {
    id: "T7",
    structureFamily: "story",
    category: "Failure",
    context: "Impromptu",
    text: "Tell me about a time you failed to deliver on something you committed to. What happened and what did you do differently?",
    recommendedDurationSeconds: 120,
    sector: "tech",
  },
  {
    id: "T8",
    structureFamily: "story",
    category: "Influence",
    context: "Impromptu",
    text: "Tell me about a time you had to align stakeholders with conflicting priorities around a single decision.",
    recommendedDurationSeconds: 120,
    sector: "tech",
  },
  {
    id: "T9",
    structureFamily: "story",
    category: "Achievement",
    context: "Impromptu",
    text: "Tell me about a time you built or launched something meaningful with limited resources or guidance.",
    recommendedDurationSeconds: 120,
    sector: "tech",
  },
  {
    id: "T10",
    structureFamily: "rationale",
    category: "AI",
    context: "Impromptu",
    text: "How do you use AI in your work? Give a specific example of where it helped and where you chose not to trust it.",
    recommendedDurationSeconds: 90,
    sector: "tech",
  },

  // ── INTERVIEW — GENERAL & OTHER SECTORS ───────────────────────────────────

  {
    id: "G1",
    structureFamily: "rationale",
    category: "Motivation",
    context: "Impromptu",
    text: "Why this organisation? What is it about the mission or work that brings you here specifically?",
    recommendedDurationSeconds: 90,
    sector: "general",
  },
  {
    id: "G2",
    structureFamily: "story",
    category: "Leadership",
    context: "Impromptu",
    text: "Tell me about a time you demonstrated leadership — formal or informal. What did you do and what was the outcome?",
    recommendedDurationSeconds: 120,
    sector: "general",
  },
  {
    id: "G3",
    structureFamily: "story",
    category: "Teamwork",
    context: "Impromptu",
    text: "Tell me about a time you worked effectively as part of a team with people very different from you. What was your role and contribution?",
    recommendedDurationSeconds: 120,
    sector: "general",
  },
  {
    id: "G4",
    structureFamily: "story",
    category: "Communication",
    context: "Impromptu",
    text: "Tell me about a time you had to communicate something complex to a non-specialist audience.",
    recommendedDurationSeconds: 120,
    sector: "general",
  },
  {
    id: "G5",
    structureFamily: "story",
    category: "Resilience",
    context: "Impromptu",
    text: "Tell me about a time you had to manage a significant challenge or setback. How did you respond?",
    recommendedDurationSeconds: 120,
    sector: "general",
  },
  {
    id: "G6",
    structureFamily: "story",
    category: "Initiative",
    context: "Impromptu",
    text: "Tell me about a time you identified an opportunity to improve something — a process, an outcome, a relationship — and acted on it.",
    recommendedDurationSeconds: 120,
    sector: "general",
  },
  {
    id: "G7",
    structureFamily: "story",
    category: "Pressure",
    context: "Impromptu",
    text: "Tell me about a time you had to balance competing priorities under pressure. How did you decide what mattered most?",
    recommendedDurationSeconds: 120,
    sector: "general",
  },
  {
    id: "G8",
    structureFamily: "story",
    category: "Adaptability",
    context: "Impromptu",
    text: "Tell me about a time you had to deliver with limited resources, support, or guidance.",
    recommendedDurationSeconds: 120,
    sector: "general",
  },
  {
    id: "G9",
    structureFamily: "story",
    category: "Influence",
    context: "Impromptu",
    text: "Tell me about a time you had to bring people with very different perspectives toward a shared outcome.",
    recommendedDurationSeconds: 120,
    sector: "general",
  },
  {
    id: "G10",
    structureFamily: "story",
    category: "Values",
    context: "Impromptu",
    text: "Tell me about a time you had to make a decision that involved a values or integrity tension. What did you do?",
    recommendedDurationSeconds: 120,
    sector: "general",
  },
];

export function getPromptContext(promptText: string): string | undefined {
  return PROMPTS.find(p => p.text === promptText)?.context;
}

// Fallback classification for prompts that aren't in the curated list —
// custom typed-in prompts, and the onboarding baseline prompts (which use
// their own wording and don't appear in PROMPTS verbatim). Deliberately
// conservative: unmatched text returns undefined, which leaves the scoring
// model on its existing generic structure guidance rather than guessing.
const FALLBACK_PATTERNS: Array<{ re: RegExp; family: StructureFamily }> = [
  { re: /tell me about yourself|walk me through your background|introduce yourself|tell me about your journey/i, family: "narrative" },
  { re: /walk me through a project|project (that )?you.?re (currently )?working on/i, family: "narrative" },
  { re: /what does success look like|where do you want to be(,| )?professionally/i, family: "vision" },
  { re: /^why (do you|are you|this)|^what is your (greatest )?weakness|^how do you use/i, family: "rationale" },
  { re: /tell me about a time|describe a (situation|time)/i, family: "story" },
];

export function getPromptStructureFamily(promptText: string): StructureFamily | undefined {
  const listed = PROMPTS.find(p => p.text === promptText)?.structureFamily;
  if (listed) return listed;
  const trimmed = promptText.trim();
  return FALLBACK_PATTERNS.find(p => p.re.test(trimmed))?.family;
}

const router = Router();

router.get("/v1/prompts", requireAuth, (req, res) => {
  const { category, sector } = req.query;
  let prompts = PROMPTS;
  if (category) prompts = prompts.filter(p => p.category === category);
  if (sector) prompts = prompts.filter(p => p.sector === sector || p.sector === "all");
  res.json({ prompts });
});

router.get("/v1/prompts/random", requireAuth, (req, res) => {
  const { category, sector } = req.query;
  let pool = PROMPTS;
  if (category) pool = pool.filter(p => p.category === category);
  if (sector) pool = pool.filter(p => p.sector === sector || p.sector === "all");
  const prompt = pool[Math.floor(Math.random() * pool.length)];
  res.json(prompt);
});

export default router;
