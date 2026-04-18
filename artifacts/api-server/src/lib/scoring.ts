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
  if (score < 4) return "Needs Focus";   // 1–3: Needs Focus
  if (score < 6) return "Developing";    // 4–5: Developing
  if (score < 8) return "Strong";        // 6–7: Strong
  return "Distinguished";                // 8–10: Distinguished
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

export interface VideoPresenceResult {
  eyeContactObservation: string;
  gestureObservation: string;
  presenceObservation: string;
  professionalAppearanceObservation: string;
  overallVisualPresence: string;
  framesAnalyzed: number;
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
  videoPresenceAnalysis?: VideoPresenceResult | null;
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

You are a senior executive presence coach listening to this audio recording. Evaluate EVERYTHING you observe from the audio — both how the person speaks AND what they say. Base every observation solely on what you actually hear. Do not make generic statements; be specific about what you heard.

Cover all of the following:

DELIVERY (how they spoke):
1. Speaking pace — fast, slow, or well-paced; note rushes or drawn-out sections
2. Pitch and intonation — does pitch vary naturally or is delivery monotone? Does pitch fall decisively at statements (authority) or rise (uncertainty)?
3. Volume and projection — consistent, too quiet, too loud, or varied
4. Vocal clarity — articulation, mumbling, dropped endings, ease of comprehension
5. Filler words — identify every type heard (um, uh, like, you know, so, basically, right, etc.) and approximate count
6. Pauses and silences — natural emphasis pauses vs. unplanned silences; note durations
7. Vocal confidence — tone sounds assured vs. tentative/uncertain
8. Energy and engagement — present and engaged vs. flat and disengaged
9. Breathing — audible breath sounds, shallow or strained breathing, breathlessness, breath control quality

CONTENT (what they said — assessed from listening):
10. Structure — Did the response have a clear, confident opening? Organized, logical flow? A decisive close? Or did it wander, ramble, or trail off? Was the prompt directly addressed? Identify specifically where structure was strong or weak.
11. Confidence language — Listen for hedging phrases ("I think", "maybe", "I guess", "kind of", "I believe", "hopefully", "I'm not sure but") versus assertive language ("I know", "We will", "The key point is", "I'm committed to", clear declarative statements). Quote specific phrases you heard. Assess whether the overall language projected authority or uncertainty.

Return your analysis as a JSON object with these exact keys:
{
  "pace": "specific observation",
  "pitchIntonation": "specific observation about pitch variation, monotone vs. dynamic, whether pitch falls authoritatively or rises with uncertainty",
  "pitchVariationScore": <integer 1-5 where 1=completely monotone, 2=minimal variation, 3=some variation but inconsistent, 4=good natural variation, 5=excellent expressive range>,
  "volume": "specific observation",
  "clarity": "specific observation",
  "fillerWords": "each filler type heard and approximate count",
  "silences": "specific observation about pauses",
  "confidence": "specific observation about vocal tone confidence",
  "energy": "specific observation",
  "breathing": "specific observation about breath control and audible breathing",
  "breathingScore": <integer 1-5 where 1=severe breathlessness/gasping, 2=noticeably shallow or strained, 3=adequate but some strain, 4=mostly controlled, 5=excellent relaxed control>,
  "structureObservation": "from listening: did the response have a clear opening, organized body, and decisive close? Was the prompt directly addressed or did the speaker wander? Quote specific moments that illustrate strong or weak structure.",
  "confidenceLanguageObservation": "from listening: list specific hedging phrases heard (quote them) and specific assertive phrases heard (quote them). Assess overall whether word choice projected authority or uncertainty.",
  "overallDeliveryQuality": "direct summary of both delivery and content in 2-3 sentences"
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
 * Analyzes video frames using Claude Vision to assess visual presence dimensions:
 * eye contact, gesture & movement, presence & engagement, professional appearance.
 * Frames should be base64-encoded JPEG strings (without the data URL prefix).
 */
export async function analyzeVideoPresence(
  frameBase64Array: string[],
  promptText?: string,
  recordingContext?: string
): Promise<VideoPresenceResult> {
  const frames = frameBase64Array.slice(0, 10);

  const analysisPrompt = `${promptText ? `The speaker was responding to this prompt: "${promptText}". ` : ""}${recordingContext ? `Recording context: ${recordingContext}.` : ""}

You are a senior executive presence coach reviewing a series of video frames captured at regular intervals during a ${recordingContext || "seated"} presentation. Analyze ONLY what you can directly observe in the images. Be specific and honest — if you cannot see something clearly, say so.

Assess the following four areas based solely on what you see:

1. EYE CONTACT: Where is the speaker looking in each frame? Are they looking directly at the camera (which represents the audience)? Do they look away frequently? How sustained is their camera connection?

2. GESTURE & MOVEMENT: Are hand or arm gestures visible? Are they purposeful, natural, and complementary to the message? Or are there distracting fidgets, excessive stillness, or no gestures at all? Describe specific movements observed.

3. PRESENCE & ENGAGEMENT: Does the speaker appear physically engaged and present? Assess posture, energy visible in body language, whether they appear animated or stiff/withdrawn. Is there visible energy and conviction?

4. PROFESSIONAL APPEARANCE: Assess attire, grooming, and background environment visible in the frames. Is the overall presentation appropriate for a professional or executive context?

Return your analysis as a JSON object with these exact keys:
{
  "eyeContactObservation": "specific description of where the speaker was looking in each frame, how often they met the camera, and overall gaze consistency",
  "gestureObservation": "specific description of hand/arm gestures observed, whether they were purposeful, absent, or distracting",
  "presenceObservation": "specific description of posture, body language, visible energy, and physical engagement observed",
  "professionalAppearanceObservation": "specific assessment of attire, grooming, and background visible in the frames",
  "overallVisualPresence": "2-sentence summary of the speaker's overall visual executive presence"
}`;

  const imageContent = frames.map(frame => ({
    type: "image" as const,
    source: {
      type: "base64" as const,
      media_type: "image/jpeg" as const,
      data: frame,
    },
  }));

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            ...imageContent,
            { type: "text", text: analysisPrompt },
          ],
        },
      ],
    });

    const rawText = response.content
      .filter(b => b.type === "text")
      .map(b => (b as { type: "text"; text: string }).text)
      .join("");

    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
      return {
        eyeContactObservation: String(parsed.eyeContactObservation || ""),
        gestureObservation: String(parsed.gestureObservation || ""),
        presenceObservation: String(parsed.presenceObservation || ""),
        professionalAppearanceObservation: String(parsed.professionalAppearanceObservation || ""),
        overallVisualPresence: String(parsed.overallVisualPresence || ""),
        framesAnalyzed: frames.length,
      };
    }
    throw new Error("No JSON found in vision response");
  } catch (err) {
    console.error("Video presence analysis failed:", err);
    throw err;
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

RULE 1 — STRICT DATA SOURCE SEPARATION BY DIMENSION TYPE:
Every dimension must be scored from its correct data source. Using the wrong source is a scoring error.

AUDIO DIMENSIONS — use Audio Delivery Analysis ONLY (never the transcript, never the video analysis):
- vocal_clarity → audio "clarity" field
- pace_rhythm → audio "pace", "pitchIntonation", "pitchVariationScore", "silences" (covers speed, rhythm, pitch variation, intonation, use of pauses)
- volume_projection → audio "volume" field
- filler_words → audio "fillerWords" field (audio model's count is authoritative; ignore any transcript-derived count)
- structure → audio "structureObservation" field
- confidence_language → audio "confidenceLanguageObservation" field

VISUAL DIMENSIONS — use Video Presence Analysis ONLY (never infer from audio, never assume from recording context):
- eye_contact → video "eyeContactObservation" field. Score based ONLY on what was directly observed in the video frames (where did the speaker look? how often did they hold camera connection?). If no video analysis: score must state it could not be assessed visually.
- gesture_movement → video "gestureObservation" field. Score based ONLY on gestures directly observed in frames. Do NOT infer from audio or recording context.
- presence_engagement → video "presenceObservation" field for physical/visual presence. May also incorporate audio "energy" and "confidence" fields for vocal energy.
- professional_appearance → video "professionalAppearanceObservation" field ONLY.

If Video Presence Analysis is missing or empty and the dimension is a visual dimension:
- Set score to null/0 and write: "Visual analysis was unavailable for this session. [dimension name] could not be assessed."
- Do NOT infer, guess, or extrapolate from audio signals for visual dimensions.

The transcript is provided as context only — never quote it or base any scoring on it.

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

AUDIO DELIVERY ANALYSIS — SOURCE FOR AUDIO DIMENSIONS (vocal_clarity, pace_rhythm, volume_projection, filler_words, structure, confidence_language):
${input.audioDeliveryAnalysis || "[No audio delivery analysis available — scoring quality will be limited]"}

${input.mode === "video" ? `VIDEO PRESENCE ANALYSIS — SOURCE FOR VISUAL DIMENSIONS (eye_contact, gesture_movement, presence_engagement, professional_appearance):
${input.videoPresenceAnalysis
  ? `Frames analyzed: ${input.videoPresenceAnalysis.framesAnalyzed}
Eye contact: ${input.videoPresenceAnalysis.eyeContactObservation}
Gesture & movement: ${input.videoPresenceAnalysis.gestureObservation}
Presence & engagement: ${input.videoPresenceAnalysis.presenceObservation}
Professional appearance: ${input.videoPresenceAnalysis.professionalAppearanceObservation}
Overall visual presence: ${input.videoPresenceAnalysis.overallVisualPresence}`
  : "[No video frame analysis available — visual dimensions cannot be assessed from video]"}` : ""}

TRANSCRIPT (context only — do NOT base any score or feedback on this):
${input.transcript ? `"${input.transcript}"` : "[No transcript captured]"}

SUPPORTING METRICS:
- Duration: ${input.durationSeconds}s (${Math.floor(input.durationSeconds / 60)}m ${input.durationSeconds % 60}s)
- Calculated speaking pace: ${wordsPerMinute} wpm (ideal: 120-160 wpm)
- Silence/pause events detected: ${input.silenceEvents}
- Mode: ${input.mode}
- Recording context: ${input.recordingContext || "seated"}

DIMENSIONS TO EVALUATE:
${dimensionList}

${
  wordCount < 30
    ? `⚠️ NOTE: The transcript is extremely short (${wordCount} words — under 30 seconds of speech). Structure and confidence_language must score 1-3 based on what the audio analysis captured.`
    : wordCount < 80
    ? `⚠️ NOTE: The transcript is brief (${wordCount} words). Structure and confidence_language scores should reflect the limited content heard in the audio analysis.`
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
