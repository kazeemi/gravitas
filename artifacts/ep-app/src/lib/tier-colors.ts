export const TIER_COLORS = {
  "Needs Focus": {
    hex: "#78736A",
    bg: "bg-[#78736A]",
    text: "text-[#78736A]",
    border: "border-[#78736A]",
    light: "bg-[#F5F3F1]",
    badge: "bg-[#78736A] text-white",
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

export const DIMENSION_LABELS: Record<string, string> = {
  vocal_clarity: "Vocal Clarity",
  pace_rhythm: "Pace, Rhythm & Vocal Variety",
  volume_projection: "Volume & Projection",
  filler_words: "Filler Words",
  structure: "Structure",
  confidence_language: "Confidence Language",
  presence_engagement: "Presence & Engagement",
  eye_contact: "Eye Contact",
  gesture_movement: "Gesture & Movement",
  professional_appearance: "Professional Appearance",
};

export const DIMENSION_DESCRIPTIONS: Record<string, string> = {
  confidence_language: "Word choice and phrasing that projects authority, conviction, and ownership.",
  structure: "How clearly ideas are organized — opening, logical flow, and strong close.",
  presence_engagement: "The sense that you command the room and hold your audience's attention.",
  vocal_clarity: "How clearly and precisely you articulate words — diction, enunciation, and ease of comprehension.",
  eye_contact: "Sustained, intentional gaze that builds connection and signals confidence.",
  pace_rhythm: "Speaking speed, rhythm, pitch variation, and intonation — avoiding monotone delivery, rushing, or dragging.",
  gesture_movement: "Use of hands and body movement to reinforce and emphasize your message.",
  filler_words: "Absence of verbal crutches (um, uh, like, you know) that undermine credibility.",
  volume_projection: "Consistent, appropriately loud delivery that carries authority without straining.",
  professional_appearance: "Dress, grooming, and on-screen framing that reinforce executive credibility.",
};

// Dimensions ordered highest to lowest weightage for display
export const DIMENSION_DISPLAY_ORDER: string[] = [
  "confidence_language",
  "structure",
  "presence_engagement",
  "vocal_clarity",
  "eye_contact",
  "pace_rhythm",
  "gesture_movement",
  "filler_words",
  "volume_projection",
  "professional_appearance",
];
