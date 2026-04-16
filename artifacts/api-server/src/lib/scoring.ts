import { anthropic } from "@workspace/integrations-anthropic-ai";
import { openai } from "@workspace/integrations-openai-ai-server";
import { ensureCompatibleFormat, speechToText } from "@workspace/integrations-openai-ai-server/audio";

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
  audioDeliveryAnalysis?: string;
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

/**
 * Uses gpt-audio model to listen to the actual audio recording and produce
 * a detailed vocal delivery analysis covering pace, tone, volume, filler words,
 * pauses, confidence, and clarity — things only hearable from the audio itself.
 */
export async function analyzeAudioDelivery(
  audioBuffer: Buffer,
  format: "wav" | "mp3",
  promptText?: string
): Promise<string> {
  const audioBase64 = audioBuffer.toString("base64");

  const analysisPrompt = `${promptText ? `The speaker was asked to respond to this prompt: "${promptText}". ` : ""}

Listen carefully to this audio recording and provide a detailed, specific vocal delivery analysis. Report only what you actually hear in the audio — do NOT guess or infer. Cover:

1. Speaking pace: was it fast, slow, or varied? Any significant rushes or drags?
2. Volume and projection: consistent? Too quiet? Too loud? Did it vary appropriately?
3. Vocal clarity: was articulation clear? Any mumbling, dropping of word endings, or poor diction?
4. Filler words: list EVERY specific filler word you heard (um, uh, like, you know, so, basically, etc.) and approximately how many times
5. Pauses and silences: any awkward long pauses? Natural pauses for emphasis? How long were they?
6. Vocal confidence: did the voice sound assured, tentative, nervous, or authoritative?
7. Vocal variety: monotone or did the pitch, pace, and energy vary appropriately?
8. Energy and engagement: did the speaker sound engaged and present, or flat and disengaged?

Be brutally honest and specific. If the speech was disorganized, say so. If the speaker sounded nervous, say so. If there were barely any words spoken, say so. Do not be encouraging if the delivery was poor.

Format your response as a JSON object:
{
  "pace": "specific observation",
  "volume": "specific observation", 
  "clarity": "specific observation",
  "fillerWords": "list each filler word and count",
  "silences": "specific observation about pauses",
  "confidence": "specific observation",
  "vocalVariety": "specific observation",
  "energy": "specific observation",
  "overallDeliveryQuality": "brief honest summary (1-2 sentences)"
}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-audio",
      modalities: ["text", "audio"],
      audio: { voice: "alloy", format: "mp3" },
      messages: [
        {
          role: "user",
          content: [
            { type: "input_audio", input_audio: { data: audioBase64, format } } as const,
            { type: "text", text: analysisPrompt } as const,
          ],
        },
      ],
    } as Parameters<typeof openai.chat.completions.create>[0]);

    const message = response.choices[0]?.message as Record<string, unknown>;
    const audioContent = message?.audio as Record<string, unknown> | undefined;
    return (audioContent?.transcript as string) || (message?.content as string) || "";
  } catch (err) {
    console.error("gpt-audio delivery analysis failed:", err);
    return "";
  }
}

/**
 * Transcribes audio using OpenAI Whisper (gpt-4o-mini-transcribe).
 * Returns the full accurate transcript.
 */
export async function transcribeAudio(audioBuffer: Buffer): Promise<string> {
  const { buffer, format } = await ensureCompatibleFormat(audioBuffer);
  return speechToText(buffer, format);
}

async function runAIEvaluation(
  input: ScoringInput,
  dimensions: DimensionKey[]
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
1. For audio/delivery dimensions (vocal_clarity, pace_rhythm, volume_projection, filler_words), base your scoring PRIMARILY on the Audio Delivery Analysis — not the transcript. These dimensions measure HOW the person spoke, not what they said.
2. For content dimensions (structure, confidence_language), base scoring on BOTH the transcript content AND how it was delivered vocally.
3. A response of fewer than 50 words is almost always Emerging (1-3) on content dimensions.
4. Never award 6+ to short/shallow responses that don't adequately address the prompt.
5. DO NOT write generic praise. Every positive comment must reference something specific.
6. DO NOT soften honest criticism. Be direct and professional.
7. Gaps and next steps must be specific and actionable.`;

  const userPrompt = `Evaluate this speaker on executive presence dimensions.

PROMPT THEY WERE RESPONDING TO:
"${input.promptText || "Open-ended speaking exercise"}"

TRANSCRIPT (accurate Whisper transcription of what they said):
${input.transcript ? `"${input.transcript}"` : "[No transcript captured]"}

AUDIO DELIVERY ANALYSIS (from direct audio evaluation — use this for delivery dimensions):
${input.audioDeliveryAnalysis || "[No audio delivery analysis available]"}

SUPPORTING METRICS:
- Duration: ${input.durationSeconds}s (${Math.floor(input.durationSeconds / 60)}m ${input.durationSeconds % 60}s)
- Word count: ${wordCount} words
- Calculated speaking pace: ${wordsPerMinute} wpm (ideal: 120-160 wpm)
- Filler words in transcript: ${fillerCount}
- Silence/pause events detected: ${input.silenceEvents}
- Mode: ${input.mode}
- Recording context: ${input.recordingContext || "seated"}

DIMENSIONS TO EVALUATE:
${dimensionList}

${
  wordCount < 30
    ? `⚠️ NOTE: This transcript is extremely short (${wordCount} words). Content dimensions (structure, confidence_language) must score 1-3.`
    : wordCount < 80
    ? `⚠️ NOTE: This transcript is brief (${wordCount} words). Content dimensions should generally score no higher than 4-5.`
    : ""
}

Return a JSON object (no markdown):
{
  "overallStrengths": "2-3 sentences on genuine strengths with specific evidence. If there are no significant strengths, say so directly.",
  "overallImprovements": "2-3 sentences on most important improvements needed. Be specific and direct.",
  "overallNextStep": "The single most impactful action before next session (1 sentence, specific and actionable).",
  "dimensions": {
    ${dimensions
      .map(
        d => `"${d}": {
      "score": <integer 1-10>,
      "strengthText": "<max 25 words — specific evidence from audio/transcript>",
      "gapText": "<max 25 words — primary gap with specific evidence>",
      "nextStepText": "<max 30 words — concrete actionable practice drill>"
    }`
      )
      .join(",\n    ")}
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
    return buildFallbackEvaluation(dimensions, wordCount);
  }
}

function buildFallbackEvaluation(
  dimensions: DimensionKey[],
  wordCount: number
): AIEvalResult {
  const baseScore = wordCount < 30 ? 2 : wordCount < 80 ? 3 : 4;
  const result: AIEvalResult = {
    overallStrengths: "Unable to generate AI feedback at this time.",
    overallImprovements:
      "Please ensure your response fully addresses the prompt with sufficient depth.",
    overallNextStep: "Record a session of at least 90 seconds with a structured response.",
    dimensions: {},
  };
  for (const d of dimensions) {
    result.dimensions[d] = {
      score: baseScore,
      strengthText: `Some foundational elements present in ${DIMENSION_LABELS[d]}.`,
      gapText: `Significant development needed in ${DIMENSION_LABELS[d]}.`,
      nextStepText: `Practice dedicated ${DIMENSION_LABELS[d]} exercises daily.`,
    };
  }
  return result;
}

export async function scoreSession(input: ScoringInput): Promise<ScoringResult> {
  const dimensions =
    input.mode === "audio" ? AUDIO_DIMENSIONS : VIDEO_DIMENSIONS;

  const audioQualityFlag = input.audioGapEvents > 5;
  const faceCoverageFlag = input.mode === "video" && input.faceLostEvents > 3;

  const aiResult = await runAIEvaluation(input, dimensions);

  const dimensionResults: DimensionResult[] = dimensions.map(key => {
    const aiDim = aiResult.dimensions[key] ?? {
      score: 3,
      strengthText: `Limited evidence of ${DIMENSION_LABELS[key]} in this session.`,
      gapText: `${DIMENSION_LABELS[key]} needs significant development.`,
      nextStepText: `Focus on ${DIMENSION_LABELS[key]} in your next session.`,
    };

    const score = Math.round(Math.min(10, Math.max(1, aiDim.score)));
    const tier = scoreToTier(score);

    return {
      dimensionKey: key,
      score,
      tier,
      rawMetrics: {
        durationSeconds: input.durationSeconds,
        audioDeliveryAnalysis: input.audioDeliveryAnalysis ? "provided" : "not available",
        aiRawScore: aiDim.score,
      },
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
