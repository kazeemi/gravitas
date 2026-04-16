export const TIER_COLORS = {
  Emerging: {
    hex: "#E24B4A",
    bg: "bg-[#E24B4A]",
    text: "text-[#E24B4A]",
    border: "border-[#E24B4A]",
    light: "bg-[#fef2f2]",
    badge: "bg-[#E24B4A] text-white",
  },
  Developing: {
    hex: "#BA7517",
    bg: "bg-[#BA7517]",
    text: "text-[#BA7517]",
    border: "border-[#BA7517]",
    light: "bg-[#fffbeb]",
    badge: "bg-[#BA7517] text-white",
  },
  Strong: {
    hex: "#0F6E56",
    bg: "bg-[#0F6E56]",
    text: "text-[#0F6E56]",
    border: "border-[#0F6E56]",
    light: "bg-[#f0fdf4]",
    badge: "bg-[#0F6E56] text-white",
  },
  Distinguished: {
    hex: "#534AB7",
    bg: "bg-[#534AB7]",
    text: "text-[#534AB7]",
    border: "border-[#534AB7]",
    light: "bg-[#f5f3ff]",
    badge: "bg-[#534AB7] text-white",
  },
} as const;

export type TierName = keyof typeof TIER_COLORS;

export function getTierColors(tier: string) {
  return TIER_COLORS[tier as TierName] || TIER_COLORS.Emerging;
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
