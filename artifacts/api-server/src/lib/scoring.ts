import { anthropic } from "@workspace/integrations-anthropic-ai";

export type DimensionKey =
  | "vocal_clarity"
  | "pace_rhythm"
  | "volume_projection"
  | "filler_words"
  | "structure"
  | "confidence_language"
  | "presence_engagement"
  | "eye_contact"
  | "gesture_movement"
  | "professional_appearance";

export const AUDIO_DIMENSIONS: DimensionKey[] = [
  "vocal_clarity",
  "pace_rhythm",
  "volume_projection",
  "filler_words",
  "structure",
  "confidence_language",
];

export const VIDEO_DIMENSIONS: DimensionKey[] = [
  ...AUDIO_DIMENSIONS,
  "presence_engagement",
  "eye_contact",
  "gesture_movement",
  "professional_appearance",
];

export const DIMENSION_LABELS: Record<DimensionKey, string> = {
  vocal_clarity: "Vocal Clarity",
  pace_rhythm: "Pace & Rhythm",
  volume_projection: "Volume & Projection",
  filler_words: "Filler Words",
  structure: "Structure",
  confidence_language: "Confidence Language",
  presence_engagement: "Presence & Engagement",
  eye_contact: "Eye Contact",
  gesture_movement: "Gesture & Movement",
  professional_appearance: "Professional Appearance",
};

export type Tier = "Emerging" | "Developing" | "Strong" | "Distinguished";

export function scoreToTier(score: number): Tier {
  if (score <= 3) return "Emerging";
  if (score <= 5) return "Developing";
  if (score <= 7) return "Strong";
  return "Distinguished";
}

export function computeCompositeTier(
  dimensionScores: Record<DimensionKey, number>
): { composite: number; tier: Tier } {
  const keys = Object.keys(dimensionScores) as DimensionKey[];
  if (keys.length === 0) return { composite: 0, tier: "Emerging" };

  const raw = keys.reduce((sum, k) => sum + dimensionScores[k], 0) / keys.length;

  const gatingDimensions: DimensionKey[] = [
    "vocal_clarity",
    "confidence_language",
    "structure",
    "presence_engagement",
  ];
  const gatingScores = gatingDimensions.filter(d => keys.includes(d)).map(d => dimensionScores[d]);
  const anyGatingLow = gatingScores.some(s => s >= 1 && s <= 3);

  let composite = raw;
  if (anyGatingLow && composite > 8.0) {
    composite = 8.0;
  }

  composite = Math.round(composite * 10) / 10;
  composite = Math.min(10, Math.max(1, composite));

  return { composite, tier: scoreToTier(composite) };
}

export interface ScoringInput {
  mode: "audio" | "video";
  durationSeconds: number;
  audioGapEvents: number;
  faceLostEvents: number;
  transcript?: string;
  recordingContext?: string;
  promptText?: string;
}

export interface DimensionResult {
  dimensionKey: DimensionKey;
  score: number;
  tier: Tier;
  rawMetrics: Record<string, unknown>;
  strengthText: string;
  gapText: string;
  nextStepText: string;
}

export interface ScoringResult {
  dimensions: DimensionResult[];
  compositeScore: number;
  compositeTier: Tier;
  audioQualityFlag: boolean;
  faceCoverageFlag: boolean;
}

async function generateCoachingText(
  dimensionKey: DimensionKey,
  score: number,
  tier: Tier,
  rawMetrics: Record<string, unknown>,
  context: { transcript?: string; promptText?: string; mode: string }
): Promise<{ strengthText: string; gapText: string; nextStepText: string }> {
  const label = DIMENSION_LABELS[dimensionKey];
  const metricsJson = JSON.stringify(rawMetrics);

  const prompt = `You are an executive presence coach providing feedback on a speaker's ${label} dimension.

Score: ${score}/10 (${tier} tier)
Mode: ${context.mode}
Raw metrics: ${metricsJson}
${context.transcript ? `Transcript excerpt: "${context.transcript.slice(0, 500)}"` : ""}
${context.promptText ? `Prompt they were responding to: "${context.promptText}"` : ""}

Provide coaching feedback in exactly this JSON format (no markdown, just JSON):
{
  "strengthText": "One sentence (max 25 words) highlighting what they did well in this dimension.",
  "gapText": "One sentence (max 25 words) identifying the primary gap or opportunity.",
  "nextStepText": "One concrete, actionable practice tip (max 30 words) to improve this dimension."
}`;

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 400,
      messages: [{ role: "user", content: prompt }],
    });
    const block = message.content[0];
    const text = block.type === "text" ? block.text : "{}";
    const parsed = JSON.parse(text);
    return {
      strengthText: parsed.strengthText || "",
      gapText: parsed.gapText || "",
      nextStepText: parsed.nextStepText || "",
    };
  } catch {
    return {
      strengthText: `Your ${label} showed some effective moments worth building on.`,
      gapText: `There is room to strengthen your ${label} for greater executive presence.`,
      nextStepText: `Practice focused exercises to improve your ${label} in your next session.`,
    };
  }
}

function computeHeuristicScores(input: ScoringInput): Record<DimensionKey, number> {
  const { durationSeconds, audioGapEvents, faceLostEvents, transcript } = input;

  const normalizedDuration = Math.min(durationSeconds / 120, 1);

  const audioGapRate = durationSeconds > 0 ? audioGapEvents / (durationSeconds / 30) : 0;
  const fillerWordRate = transcript
    ? (transcript.match(/\b(um|uh|like|you know|so|basically|literally|actually|right)\b/gi) || []).length /
      Math.max(transcript.split(/\s+/).length / 100, 1)
    : audioGapRate * 2;

  const wordsPerMinute = transcript && durationSeconds > 0
    ? (transcript.split(/\s+/).length / durationSeconds) * 60
    : 130;
  const paceScore = wordsPerMinute >= 120 && wordsPerMinute <= 160
    ? 8
    : wordsPerMinute >= 100 && wordsPerMinute <= 180
    ? 6
    : 4;

  const volumeScore = audioGapRate < 0.5 ? 7 + normalizedDuration * 2 : 5;

  const vocalClarity = Math.max(1, Math.min(10, 7 - audioGapRate * 2 + normalizedDuration));

  const fillerScore = Math.max(1, Math.min(10, 9 - fillerWordRate * 1.5));

  let structureScore = 5;
  if (transcript) {
    const hasOpening = /\b(today|let me|i want to|i'd like to|we're here)\b/i.test(transcript);
    const hasClosing = /\b(in conclusion|to summarize|in summary|finally|thank you)\b/i.test(transcript);
    structureScore = 5 + (hasOpening ? 1.5 : 0) + (hasClosing ? 1.5 : 0) + normalizedDuration * 2;
  }

  const confidenceIndicators = transcript
    ? (transcript.match(/\b(I believe|I'm confident|clearly|certainly|absolutely|definitely|we will|we can)\b/gi) || []).length
    : 0;
  const hedgeIndicators = transcript
    ? (transcript.match(/\b(maybe|perhaps|might|kind of|sort of|I guess|I think|possibly)\b/gi) || []).length
    : 3;
  const confidenceScore = Math.max(1, Math.min(10, 5 + confidenceIndicators * 0.5 - hedgeIndicators * 0.5));

  const faceLostRate = durationSeconds > 0 ? faceLostEvents / (durationSeconds / 30) : 0;
  const presenceScore = Math.max(1, Math.min(10, 7 - faceLostRate * 2 + normalizedDuration));
  const eyeContactScore = Math.max(1, Math.min(10, 7 - faceLostRate * 3));
  const gestureScore = Math.max(1, Math.min(10, 5 + normalizedDuration * 3));
  const appearanceScore = input.recordingContext === "standing" ? 7 : 6;

  return {
    vocal_clarity: Math.round(Math.min(10, Math.max(1, vocalClarity))),
    pace_rhythm: Math.round(Math.min(10, Math.max(1, paceScore))),
    volume_projection: Math.round(Math.min(10, Math.max(1, volumeScore))),
    filler_words: Math.round(Math.min(10, Math.max(1, fillerScore))),
    structure: Math.round(Math.min(10, Math.max(1, structureScore))),
    confidence_language: Math.round(Math.min(10, Math.max(1, confidenceScore))),
    presence_engagement: Math.round(Math.min(10, Math.max(1, presenceScore))),
    eye_contact: Math.round(Math.min(10, Math.max(1, eyeContactScore))),
    gesture_movement: Math.round(Math.min(10, Math.max(1, gestureScore))),
    professional_appearance: Math.round(Math.min(10, Math.max(1, appearanceScore))),
  };
}

export async function scoreSession(input: ScoringInput): Promise<ScoringResult> {
  const dimensions = input.mode === "audio" ? AUDIO_DIMENSIONS : VIDEO_DIMENSIONS;
  const heuristic = computeHeuristicScores(input);

  const audioQualityFlag = input.audioGapEvents > 5;
  const faceCoverageFlag = input.mode === "video" && input.faceLostEvents > 3;

  const dimensionResults: DimensionResult[] = await Promise.all(
    dimensions.map(async (key) => {
      const score = heuristic[key];
      const tier = scoreToTier(score);
      const rawMetrics: Record<string, unknown> = {
        durationSeconds: input.durationSeconds,
        audioGapEvents: input.audioGapEvents,
        ...(input.mode === "video" ? { faceLostEvents: input.faceLostEvents } : {}),
      };

      const coaching = await generateCoachingText(key, score, tier, rawMetrics, {
        transcript: input.transcript,
        promptText: input.promptText,
        mode: input.mode,
      });

      return { dimensionKey: key, score, tier, rawMetrics, ...coaching };
    })
  );

  const scoreMap = Object.fromEntries(
    dimensionResults.map(d => [d.dimensionKey, d.score])
  ) as Record<DimensionKey, number>;

  const { composite, tier: compositeTier } = computeCompositeTier(scoreMap);

  return {
    dimensions: dimensionResults,
    compositeScore: composite,
    compositeTier,
    audioQualityFlag,
    faceCoverageFlag,
  };
}
