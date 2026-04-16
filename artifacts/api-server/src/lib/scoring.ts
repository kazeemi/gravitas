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
  const gatingScores = gatingDimensions
    .filter(d => keys.includes(d))
    .map(d => dimensionScores[d]);
  const anyGatingLow = gatingScores.some(s => s >= 1 && s <= 3);

  let composite = raw;
  if (anyGatingLow && composite > 8.0) composite = 8.0;

  composite = Math.round(composite * 10) / 10;
  composite = Math.min(10, Math.max(1, composite));

  return { composite, tier: scoreToTier(composite) };
}

export interface ScoringInput {
  mode: "audio" | "video";
  durationSeconds: number;
  audioGapEvents: number;
  faceLostEvents: number;
  silenceEvents: number;
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
  overallFeedback: string;
}

interface AIDimensionEval {
  score: number;
  strengthText: string;
  gapText: string;
  nextStepText: string;
}

interface AIEvalResult {
  overallStrengths: string;
  overallImprovements: string;
  overallNextStep: string;
  dimensions: Record<string, AIDimensionEval>;
}

async function runAIEvaluation(
  input: ScoringInput,
  dimensions: DimensionKey[],
  deliveryMetrics: Record<string, unknown>
): Promise<AIEvalResult> {
  const wordCount = input.transcript
    ? input.transcript.trim().split(/\s+/).filter(Boolean).length
    : 0;
  const wordsPerMinute =
    input.durationSeconds > 0
      ? Math.round((wordCount / input.durationSeconds) * 60)
      : 0;

  const fillerCount = input.transcript
    ? (
        input.transcript.match(
          /\b(um+|uh+|like|you know|so,?|basically|literally|actually|right\?|i mean|kind of|sort of|you see)\b/gi
        ) || []
      ).length
    : 0;

  const dimensionList = dimensions
    .map(d => `- ${d}: ${DIMENSION_LABELS[d]}`)
    .join("\n");

  const systemPrompt = `You are a senior executive presence coach and evaluator with 20+ years of experience coaching C-suite executives. Your role is to provide HONEST, CALIBRATED, and RIGOROUS assessment.

SCORING CALIBRATION — follow this strictly:
- 1-2 (Emerging): Absent, severely deficient, or harmful. Almost no evidence of the skill.
- 3 (Emerging): Minimal, inconsistent, or unintentional demonstration. Major gaps throughout.
- 4-5 (Developing): Some evidence of the skill but significant inconsistency, gaps, or missed opportunities.
- 6-7 (Strong): Solid, consistent demonstration with only minor gaps. Meets expectations for a professional speaker.
- 8-9 (Distinguished): Noticeably above average; few coaches would find fault. Impressive control and intentionality.
- 10 (Distinguished): Exceptionally rare — reserved for world-class delivery. Almost never awarded.

CRITICAL RULES:
1. Base ALL feedback ONLY on what is explicitly present in the transcript and observable metrics. Never infer, project, or assume positive qualities that are not evident.
2. A response of fewer than 50 words is almost always Emerging (1-3) on content dimensions (structure, confidence_language). Do not award 5+ to short responses.
3. An incomplete response that does not address the full prompt must be scored low on structure and confidence.
4. If the transcript shows casual/informal language (e.g., "friend", "alright") in a professional context, penalize confidence_language.
5. If there is no clear opening, development, and closing, score structure ≤ 4.
6. DO NOT write generic praise. Every positive comment must reference something specific from the transcript.
7. DO NOT soften honest criticism with flattery. Be direct and professional.
8. Gaps and next steps must be specific and actionable — not generic advice.`;

  const userPrompt = `Evaluate this speaker on executive presence dimensions.

PROMPT THEY WERE RESPONDING TO:
"${input.promptText || "Open-ended speaking exercise"}"

TRANSCRIPT (what they actually said):
${input.transcript ? `"${input.transcript}"` : "[No transcript captured — evaluate delivery metrics only]"}

DELIVERY METRICS:
- Duration: ${input.durationSeconds}s (${Math.floor(input.durationSeconds / 60)}m ${input.durationSeconds % 60}s)
- Word count: ${wordCount} words
- Speaking pace: ${wordsPerMinute} words/minute (ideal: 120-160 wpm)
- Filler words detected: ${fillerCount} (${wordCount > 0 ? ((fillerCount / wordCount) * 100).toFixed(1) : 0}% of words)
- Silence/pause events: ${input.silenceEvents}
- Audio gap events: ${input.audioGapEvents}
${input.mode === "video" ? `- Face lost events: ${input.faceLostEvents}` : ""}
- Session mode: ${input.mode}
- Recording context: ${input.recordingContext || "seated"}

DIMENSIONS TO EVALUATE:
${dimensionList}

${
  wordCount < 30
    ? `⚠️ EVALUATOR NOTE: This transcript is extremely short (${wordCount} words). Content-based dimensions (structure, confidence_language) must score 1-3 unless there is clear, exceptional quality in the few words spoken. Short duration alone is a major deficiency.`
    : wordCount < 80
    ? `⚠️ EVALUATOR NOTE: This transcript is brief (${wordCount} words). Content dimensions should generally score no higher than 4-5 unless the content is unusually strong and directly addresses the prompt.`
    : ""
}

Return a JSON object with this exact structure (no markdown, just JSON):
{
  "overallStrengths": "2-3 sentences summarizing the genuine strengths observed. Must be grounded in specific evidence from the transcript/metrics. If there are no significant strengths, say so honestly.",
  "overallImprovements": "2-3 sentences identifying the most important areas to improve. Be specific and direct.",
  "overallNextStep": "The single most impactful action this speaker should take before their next session (1 sentence, specific and actionable).",
  "dimensions": {
    ${dimensions.map(d => `"${d}": {
      "score": <integer 1-10>,
      "strengthText": "<one sentence, max 25 words, what specifically they did well — or state honestly if nothing stands out>",
      "gapText": "<one sentence, max 25 words, the primary gap — must reference specific evidence>",
      "nextStepText": "<one sentence, max 30 words, a concrete actionable practice drill>"
    }`).join(",\n    ")}
  }
}`;

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      messages: [{ role: "user", content: userPrompt }],
      system: systemPrompt,
    });

    const block = message.content[0];
    const text = block.type === "text" ? block.text.trim() : "{}";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text) as AIEvalResult;
    return parsed;
  } catch (err) {
    return buildFallbackEvaluation(input, dimensions, wordCount);
  }
}

function buildFallbackEvaluation(
  input: ScoringInput,
  dimensions: DimensionKey[],
  wordCount: number
): AIEvalResult {
  const baseScore = wordCount < 30 ? 2 : wordCount < 80 ? 3 : 4;
  const result: AIEvalResult = {
    overallStrengths: "Unable to generate AI feedback at this time.",
    overallImprovements:
      "Please ensure your response fully addresses the prompt with sufficient depth and duration.",
    overallNextStep: "Record a session of at least 90 seconds with a structured response to the prompt.",
    dimensions: {},
  };
  for (const d of dimensions) {
    result.dimensions[d] = {
      score: baseScore,
      strengthText: `Some foundational elements were present in your ${DIMENSION_LABELS[d]}.`,
      gapText: `Significant development needed in ${DIMENSION_LABELS[d]} for executive presence.`,
      nextStepText: `Practice dedicated ${DIMENSION_LABELS[d]} exercises for 10 minutes daily.`,
    };
  }
  return result;
}

function applyDeliveryAdjustments(
  aiScores: Record<string, AIDimensionEval>,
  input: ScoringInput
): Record<string, AIDimensionEval> {
  const adjusted = { ...aiScores };
  const { durationSeconds, audioGapEvents, silenceEvents } = input;

  const audioGapRate =
    durationSeconds > 0 ? audioGapEvents / (durationSeconds / 30) : 0;

  if (adjusted["vocal_clarity"]) {
    const penalty = Math.min(2, Math.round(audioGapRate));
    adjusted["vocal_clarity"] = {
      ...adjusted["vocal_clarity"],
      score: Math.max(1, adjusted["vocal_clarity"].score - penalty),
    };
  }

  if (adjusted["pace_rhythm"]) {
    const transcript = input.transcript || "";
    const wordCount = transcript.trim().split(/\s+/).filter(Boolean).length;
    const wpm =
      durationSeconds > 0 ? Math.round((wordCount / durationSeconds) * 60) : 0;
    if (wpm > 0 && (wpm < 100 || wpm > 190)) {
      adjusted["pace_rhythm"] = {
        ...adjusted["pace_rhythm"],
        score: Math.max(1, adjusted["pace_rhythm"].score - 1),
      };
    }
  }

  if (adjusted["filler_words"] && input.transcript) {
    const fillers = (
      input.transcript.match(
        /\b(um+|uh+|like|you know|so,?|basically|literally|actually|right\?|i mean|kind of|sort of)\b/gi
      ) || []
    ).length;
    const wordCount = input.transcript.trim().split(/\s+/).filter(Boolean).length;
    const fillerRate = wordCount > 0 ? fillers / wordCount : 0;
    if (fillerRate > 0.1) {
      adjusted["filler_words"] = {
        ...adjusted["filler_words"],
        score: Math.max(1, Math.min(adjusted["filler_words"].score, 4)),
      };
    }
  }

  if (adjusted["presence_engagement"] && input.mode === "video") {
    const faceLostRate =
      durationSeconds > 0 ? input.faceLostEvents / (durationSeconds / 30) : 0;
    if (faceLostRate > 1) {
      adjusted["presence_engagement"] = {
        ...adjusted["presence_engagement"],
        score: Math.max(1, adjusted["presence_engagement"].score - 2),
      };
    }
  }

  if (silenceEvents > 3) {
    const penalty = Math.min(2, Math.floor(silenceEvents / 3));
    for (const key of ["vocal_clarity", "pace_rhythm"] as const) {
      if (adjusted[key]) {
        adjusted[key] = {
          ...adjusted[key],
          score: Math.max(1, adjusted[key].score - penalty),
        };
      }
    }
  }

  return adjusted;
}

export async function scoreSession(input: ScoringInput): Promise<ScoringResult> {
  const dimensions =
    input.mode === "audio" ? AUDIO_DIMENSIONS : VIDEO_DIMENSIONS;

  const audioQualityFlag = input.audioGapEvents > 5;
  const faceCoverageFlag = input.mode === "video" && input.faceLostEvents > 3;

  const deliveryMetrics: Record<string, unknown> = {
    durationSeconds: input.durationSeconds,
    audioGapEvents: input.audioGapEvents,
    silenceEvents: input.silenceEvents,
    ...(input.mode === "video" ? { faceLostEvents: input.faceLostEvents } : {}),
  };

  const aiResult = await runAIEvaluation(input, dimensions, deliveryMetrics);

  const adjustedDimensions = applyDeliveryAdjustments(
    aiResult.dimensions,
    input
  );

  const dimensionResults: DimensionResult[] = dimensions.map(key => {
    const aiDim = adjustedDimensions[key] || {
      score: 3,
      strengthText: `Limited evidence of ${DIMENSION_LABELS[key]} in this session.`,
      gapText: `${DIMENSION_LABELS[key]} needs significant development.`,
      nextStepText: `Focus on ${DIMENSION_LABELS[key]} in your next practice session.`,
    };

    const score = Math.round(Math.min(10, Math.max(1, aiDim.score)));
    const tier = scoreToTier(score);

    return {
      dimensionKey: key,
      score,
      tier,
      rawMetrics: { ...deliveryMetrics, aiRawScore: aiDim.score },
      strengthText: aiDim.strengthText || "",
      gapText: aiDim.gapText || "",
      nextStepText: aiDim.nextStepText || "",
    };
  });

  const scoreMap = Object.fromEntries(
    dimensionResults.map(d => [d.dimensionKey, d.score])
  ) as Record<DimensionKey, number>;

  const { composite, tier: compositeTier } = computeCompositeTier(scoreMap);

  const overallFeedback = JSON.stringify({
    strengths: aiResult.overallStrengths,
    improvements: aiResult.overallImprovements,
    nextStep: aiResult.overallNextStep,
  });

  return {
    dimensions: dimensionResults,
    compositeScore: composite,
    compositeTier,
    audioQualityFlag,
    faceCoverageFlag,
    overallFeedback,
  };
}
