export const TIER_COLORS = {
  "Needs Focus": {
    hex: "#8a8584",
    bg: "bg-[#8a8584]",
    text: "text-[#8a8584]",
    border: "border-[#8a8584]",
    light: "bg-[#F0EEEE]",
    badge: "bg-[#8a8584] text-white",
  },
  Developing: {
    hex: "#F0953E",
    bg: "bg-[#F0953E]",
    text: "text-[#F0953E]",
    border: "border-[#F0953E]",
    light: "bg-[#FEF3E6]",
    badge: "bg-[#F0953E] text-white",
  },
  Strong: {
    hex: "#C84A18",
    bg: "bg-[#C84A18]",
    text: "text-[#C84A18]",
    border: "border-[#C84A18]",
    light: "bg-[#FAF0EC]",
    badge: "bg-[#C84A18] text-white",
  },
  Distinguished: {
    hex: "#0F1B2D",
    bg: "bg-[#0F1B2D]",
    text: "text-[#0F1B2D]",
    border: "border-[#0F1B2D]",
    light: "bg-[#EEF0F5]",
    badge: "bg-[#0F1B2D] text-white",
  },
} as const;

export type TierName = keyof typeof TIER_COLORS;

export function getTierColors(tier: string) {
  return TIER_COLORS[tier as TierName] || TIER_COLORS["Needs Focus"];
}

// ============================================================
// v4.0 — 15 Dimensions across 4 Pillars
// ============================================================

export const DIMENSION_LABELS: Record<string, string> = {
  // Pillar 1: Voice Quality
  articulation: "Articulation",
  projection: "Projection",
  vocal_tone: "Vocal Tone",
  vocal_steadiness: "Vocal Steadiness",
  // Pillar 2: Vocal Delivery
  intonation: "Intonation",
  pace: "Pace",
  pausing: "Pausing",
  breath_control: "Breath Control",
  // Pillar 3: Thought Clarity
  confidence_language: "Confidence Language",
  structure: "Structure",
  conciseness: "Conciseness",
  // Pillar 4: Physical Delivery
  eye_contact: "Eye Contact",
  facial_expression: "Facial Expression",
  gestures: "Gestures",
  posture: "Posture",
};

export const DIMENSION_DESCRIPTIONS: Record<string, string> = {
  // Pillar 1
  articulation: "How clearly and precisely words are formed — whether every word lands fully or sounds are dropped, slurred, or muffled.",
  projection: "Whether the voice carries with consistent authority from the beginning to the end of each phrase.",
  vocal_tone: "The richness, warmth, and resonance of the voice as an instrument — what makes a voice compelling to listen to.",
  vocal_steadiness: "The absence of anxiety signals in the voice — tremor, irregular pitch fluctuation, or tension-driven strain.",
  // Pillar 2
  intonation: "The variation in pitch across delivery — whether the voice rises and falls purposefully to signal emphasis and structure.",
  pace: "Whether speaking speed is controlled, appropriate for the context, and purposefully varied to serve the message.",
  pausing: "The deliberate use of silence as a communication tool — strategic pauses at idea boundaries that let points land.",
  breath_control: "Whether breath supports delivery through full phrases or the voice thins at endings and forces mid-thought breaks.",
  // Pillar 3
  confidence_language: "The balance between assertive and hedging language — direct ownership of ideas versus qualified, tentative expression.",
  structure: "Whether the response has clear architecture — an opening that signals direction, organised body, and decisive close.",
  conciseness: "Whether the speaker says what needs to be said and stops — without repetition, padding, or over-explanation.",
  // Pillar 4
  eye_contact: "How consistently and intentionally the speaker connects with the camera — the equivalent of direct eye contact in a room.",
  facial_expression: "Whether facial expression matches the content — conveying appropriate warmth, conviction, and engagement.",
  gestures: "Whether hand and arm movements serve the communication or compete with it through purposeless or nervous movement.",
  posture: "Whether the speaker's physical presence communicates authority and settledness — upright, open, and deliberate.",
};

// ============================================================
// PILLAR GROUPINGS — v4.0
// ============================================================

export interface Pillar {
  name: string;
  dimensions: string[];
  videoWeight: number;
  audioWeight: number;
}

export const PILLARS: Pillar[] = [
  {
    name: "Thought Clarity",
    dimensions: ["confidence_language", "structure", "conciseness"],
    videoWeight: 0.35,
    audioWeight: 0.45,
  },
  {
    name: "Vocal Delivery",
    dimensions: ["intonation", "pace", "pausing", "breath_control"],
    videoWeight: 0.25,
    audioWeight: 0.30,
  },
  {
    name: "Voice Quality",
    dimensions: ["articulation", "projection", "vocal_tone", "vocal_steadiness"],
    videoWeight: 0.20,
    audioWeight: 0.25,
  },
  {
    name: "Physical Delivery",
    dimensions: ["eye_contact", "facial_expression", "gestures", "posture"],
    videoWeight: 0.20,
    audioWeight: 0, // not scored in audio mode
  },
];

// Display order: pillar by pillar, highest-weighted first (Thought Clarity → Vocal Delivery → Voice Quality → Physical Delivery)
export const DIMENSION_DISPLAY_ORDER: string[] = [
  // Thought Clarity (35% video / 45% audio — highest weight)
  "confidence_language",
  "structure",
  "conciseness",
  // Vocal Delivery (25% video / 30% audio)
  "intonation",
  "pace",
  "pausing",
  "breath_control",
  // Voice Quality (20% video / 25% audio)
  "articulation",
  "projection",
  "vocal_tone",
  "vocal_steadiness",
  // Physical Delivery (20% video only)
  "eye_contact",
  "facial_expression",
  "gestures",
  "posture",
];

// ============================================================
// TIER THRESHOLDS — v4.0
// ============================================================

export const TIER_THRESHOLDS = {
  needsFocusMax: 3.9,    // 1.0–3.9
  developingMax: 6.4,    // 4.0–6.4
  strongMax: 8.4,        // 6.5–8.4
  distinguishedMin: 8.5, // 8.5–10.0
};
