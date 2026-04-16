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

export type Tier = "Needs Focus" | "Developing" | "Strong" | "Distinguished";

export function scoreToTier(score: number): Tier {
  if (score <= 3) return "Needs Focus";
  if (score <= 5) return "Developing";
  if (score <= 7) return "Strong";
  return "Distinguished";
}

export function computeCompositeTier(
  dimensionScores: Record<DimensionKey, number>
): { composite: number; tier: Tier } {
  const keys = Object.keys(dimensionScores) as DimensionKey[];
  if (keys.length === 0) return { composite: 0, tier: "Needs Focus" };

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

export interface AudioDeliveryResult {
  analysisText: string;
  pitchVariationScore: number | null;
  breathingScore: number | null;
  breathingObservation: string | null;
}

export interface ScoringInput {
  mode: "audio" | "video";
  durationSeconds: number;
  audioGapEvents: number;
  faceLostEvents: number;
  silenceEvents: number;
  transcript?: string;
  audioDeliveryAnalysis?: string;
  pitchVariationScore?: number | null;
  breathingScore?: number | null;
  breathingObservation?: string | null;
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
 * pauses, confidence, clarity, pitch variation, and breathing quality.
 */
export async function analyzeAudioDelivery(
  audioBuffer: Buffer,
  format: "wav" | "mp3",
  promptText?: string
): Promise<AudioDeliveryResult> {
  const audioBase64 = audioBuffer.toString("base64");

  const analysisPrompt = `${promptText ? `The speaker was responding to this prompt: "${promptText}". ` : ""}

Please listen carefully to this audio recording and provide a detailed, accurate vocal delivery analysis. Base your observations only on what you actually hear. Cover each of the following areas:

1. Speaking pace: rate as fast, slow, or well-paced; note any significant rushes or drawn-out sections
2. Pitch and intonation: does pitch vary naturally or is delivery monotone? Does pitch rise/fall appropriately at key points? Does it fall decisively at the end of statements (authority) or rise (uncertainty)?
3. Volume and projection: note whether volume is consistent, too quiet, too loud, or appropriately varied
4. Vocal clarity: assess articulation quality; note any mumbling, dropped endings, or unclear diction
5. Filler words: identify each type of filler word heard (um, uh, like, you know, so, basically, right, etc.) and approximate frequency
6. Pauses and silences: distinguish natural emphasis pauses from extended unplanned silences; note duration where significant
7. Vocal confidence: characterize whether the tone sounds assured, tentative, or uncertain
8. Energy and engagement: note whether the speaker sounds present and engaged or flat and disengaged
9. Breathing: can you hear audible breath sounds, shallow breathing, breathlessness, or poor breath support? Does the speaker run out of breath mid-sentence? Is breath control relaxed and controlled, or strained and effortful?

Be specific and accurate. If delivery is weak in an area, describe exactly what you observed. If delivery is strong, describe what you observed. Avoid generic statements.

Return your analysis as a JSON object with these exact keys:
{
  "pace": "specific observation about speaking speed",
  "pitchIntonation": "specific observation about pitch variation, monotone vs. dynamic delivery, whether pitch falls decisively at statements or rises (uncertainty), and intonation patterns",
  "pitchVariationScore": <integer 1-5 where 1=completely monotone/flat, 2=minimal variation, 3=some variation but inconsistent, 4=good natural variation, 5=excellent expressive dynamic range>,
  "volume": "specific observation",
  "clarity": "specific observation",
  "fillerWords": "each filler type and approximate count",
  "silences": "specific observation about pauses and silences",
  "confidence": "specific observation",
  "energy": "specific observation",
  "breathing": "specific observation about breath control, audible breathing, breathlessness, or breath support quality",
  "breathingScore": <integer 1-5 where 1=severely out of breath or audible gasping, 2=noticeably shallow or strained, 3=adequate but some strain detectable, 4=mostly controlled and relaxed, 5=excellent breath control, relaxed and effortless>,
  "overallDeliveryQuality": "direct summary in 1-2 sentences"
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
    const rawText = (audioContent?.transcript as string) || (message?.content as string) || "";

    let pitchVariationScore: number | null = null;
    let breathingScore: number | null = null;
    let breathingObservation: string | null = null;

    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
        const pvs = Number(parsed.pitchVariationScore);
        if (!isNaN(pvs) && pvs >= 1 && pvs <= 5) pitchVariationScore = pvs;
        const bs = Number(parsed.breathingScore);
        if (!isNaN(bs) && bs >= 1 && bs <= 5) breathingScore = bs;
        if (typeof parsed.breathing === "string") breathingObservation = parsed.breathing;
      }
    } catch {
      // parsing failure — scores remain null
    }

    return { analysisText: rawText, pitchVariationScore, breathingScore, breathingObservation };
  } catch (err) {
    console.error("gpt-audio delivery analysis failed:", err);
    return { analysisText: "", pitchVariationScore: null, breathingScore: null, breathingObservation: null };
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
- 1-2 (Needs Focus): Absent, severely deficient, or harmful. Almost no evidence of the skill.
- 3 (Needs Focus): Minimal, inconsistent, or unintentional demonstration. Major gaps throughout.
- 4-5 (Developing): Some evidence of the skill but significant inconsistency, gaps, or missed opportunities.
- 6-7 (Strong): Solid, consistent demonstration with only minor gaps. Meets expectations for a professional speaker.
- 8-9 (Distinguished): Noticeably above average; few coaches would find fault. Impressive control and intentionality.
- 10 (Distinguished): Exceptionally rare — reserved for world-class delivery. Almost never awarded.

CRITICAL RULES:

RULE 1 — DATA SOURCES FOR EACH DIMENSION TYPE:
- vocal_clarity, pace_rhythm, volume_projection, filler_words: Score and write feedback EXCLUSIVELY from the Audio Delivery Analysis. These dimensions measure HOW the person spoke, not what they said. The transcript is irrelevant for these four dimensions. If audio analysis says 5-6 fillers were heard, that is the fact — do not reference or compare to the transcript's filler count.
- pace_rhythm specifically covers: speaking speed, rhythm, pitch variation, intonation (does pitch fall authoritatively at the end of statements, or rise with uncertainty?), monotone vs. dynamic delivery, and use of pauses for emphasis. Evaluate all of these from the audio pitchIntonation and pace fields.
- structure, confidence_language: Score and write feedback based on the transcript content AND any relevant vocal delivery observations.

RULE 2 — STRENGTHS MUST BE GENUINE:
A strength is only a strength if it represents actual positive behavior that serves the session's objective. Do not reframe partial, inadequate, or counterproductive behavior as a positive. Specifically:
- If the speaker was asked to negotiate but instead capitulated or made unconditional promises, this is a failure — not a strength in "client orientation."
- If the speaker avoided the core task of the prompt entirely, this is a failure — not a strength in "staying calm."
- If there are no genuine strengths, write exactly: "This session did not demonstrate significant strengths in the areas assessed."
- A positive comment is only valid if the behavior it describes would be considered successful by an objective evaluator.

RULE 3 — NO CONTRADICTIONS IN FEEDBACK:
Each dimension's strengthText and gapText must be consistent with each other and with the score. Do not say something is a strength and then give a gap that contradicts it. Pick the single most important observation for each.

RULE 4 — CALIBRATION:
- A response of fewer than 50 words almost always scores 1-3 on content dimensions.
- Never award 6+ to shallow responses that don't address the prompt.
- Be direct. Do not understate genuine gaps.
- Gaps and next steps must be specific and actionable.`;

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
${!input.audioDeliveryAnalysis ? `- Filler words in transcript: ${fillerCount} (no audio analysis available — use this as a rough indicator only)` : `- Note: Audio delivery analysis is present above — use it as the sole source for all delivery dimension scores (vocal_clarity, pace_rhythm, volume_projection, filler_words). Ignore transcript-derived filler counts for those dimensions.`}
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
  "overallNextStep": "The single most impactful action to practice before recording the next session here (1 sentence, specific and actionable). Do not reference external apps, tools, or websites. Never suggest a target duration under 60 seconds.",
  "dimensions": {
    ${dimensions
      .map(
        d => `"${d}": {
      "score": <integer 1-10>,
      "strengthText": "<max 25 words — specific evidence from audio/transcript>",
      "gapText": "<max 25 words — primary gap with specific evidence>",
      "nextStepText": "<max 30 words — a specific practice drill the speaker can do by recording another session here. Do not recommend external apps, tools, or websites. Never suggest a target recording duration under 60 seconds.>"
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

    const rawMetrics: Record<string, unknown> = {
      durationSeconds: input.durationSeconds,
      audioDeliveryAnalysis: input.audioDeliveryAnalysis ? "provided" : "not available",
      aiRawScore: aiDim.score,
    };

    if (key === "pace_rhythm" && input.pitchVariationScore != null) {
      rawMetrics.pitchVariationScore = input.pitchVariationScore;
    }
    if (key === "vocal_clarity") {
      if (input.breathingScore != null) rawMetrics.breathingScore = input.breathingScore;
      if (input.breathingObservation) rawMetrics.breathingObservation = input.breathingObservation;
    }

    return {
      dimensionKey: key,
      score,
      tier,
      rawMetrics,
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
