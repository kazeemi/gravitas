import { anthropic } from "@workspace/integrations-anthropic-ai";
import { openai } from "@workspace/integrations-openai-ai-server";
import { logger } from "./logger.js";
import type { StructureFamily } from "../routes/prompts.js";
import {
  ensureCompatibleFormat,
  speechToText,
  speechToTextWithTiming,
  type CompatibleFormat,
  type RmsMetrics,
  type F0Metrics,
  type PauseMetrics,
  type WpmWindow,
} from "@workspace/integrations-openai-ai-server/audio";

// ============================================================
// DIMENSION KEYS — v4.0 (15 dimensions across 4 pillars)
// ============================================================

export type DimensionKey =
  // Pillar 1: Voice Quality
  | "articulation"
  | "projection"
  | "vocal_tone"
  | "vocal_steadiness"
  // Pillar 2: Vocal Delivery
  | "intonation"
  | "pace"
  | "pausing"
  | "breath_control"
  // Pillar 3: Thought Clarity
  | "confidence_language"
  | "structure"
  | "conciseness"
  // Pillar 4: Physical Delivery (video only)
  | "eye_contact"
  | "facial_expression"
  | "gestures"
  | "posture";

// Audio-only sessions: 11 dimensions (Pillar 4 excluded)
export const AUDIO_DIMENSIONS: DimensionKey[] = [
  // Thought Clarity (highest weight)
  "confidence_language",
  "structure",
  "conciseness",
  // Vocal Delivery
  "intonation",
  "pace",
  "pausing",
  "breath_control",
  // Voice Quality
  "articulation",
  "projection",
  "vocal_tone",
  "vocal_steadiness",
];

// Video sessions: all 15 dimensions
export const VIDEO_DIMENSIONS: DimensionKey[] = [
  ...AUDIO_DIMENSIONS,
  "eye_contact",
  "facial_expression",
  "gestures",
  "posture",
];

export const DIMENSION_LABELS: Record<DimensionKey, string> = {
  articulation: "Articulation",
  projection: "Projection",
  vocal_tone: "Vocal Tone",
  vocal_steadiness: "Vocal Steadiness",
  intonation: "Intonation",
  pace: "Pace",
  pausing: "Pausing",
  breath_control: "Breath Control",
  confidence_language: "Confidence Language",
  structure: "Structure",
  conciseness: "Conciseness",
  eye_contact: "Eye Contact",
  facial_expression: "Facial Expression",
  gestures: "Gestures",
  posture: "Posture",
};

// ============================================================
// TIER SYSTEM — v4.0 thresholds
// ============================================================

// Note: user elected to keep "Needs Focus" label (not rename to "Needs Work")
export type Tier = "Needs Focus" | "Developing" | "Strong" | "Distinguished";

export function scoreToTier(score: number): Tier {
  if (score < 4) return "Needs Focus";    // 1.0–3.9
  if (score < 6.5) return "Developing";  // 4.0–6.4
  if (score < 8.5) return "Strong";      // 6.5–8.4
  return "Distinguished";                // 8.5–10.0
}

// ============================================================
// DIMENSION WEIGHTS — v4.0
// ============================================================

const VIDEO_WEIGHTS: Record<DimensionKey, number> = {
  // Pillar 1: Voice Quality (20%)
  articulation: 0.04,
  projection: 0.06,
  vocal_tone: 0.08,
  vocal_steadiness: 0.02,
  // Pillar 2: Vocal Delivery (25%)
  intonation: 0.08,
  pace: 0.07,
  pausing: 0.06,
  breath_control: 0.04,
  // Pillar 3: Thought Clarity (35%)
  confidence_language: 0.13,
  structure: 0.15,
  conciseness: 0.07,
  // Pillar 4: Physical Delivery (20%)
  eye_contact: 0.08,
  facial_expression: 0.04,
  gestures: 0.03,
  posture: 0.05,
};

const AUDIO_WEIGHTS: Record<DimensionKey, number> = {
  // Pillar 1: Voice Quality (25%)
  articulation: 0.05,
  projection: 0.07,
  vocal_tone: 0.09,
  vocal_steadiness: 0.04,
  // Pillar 2: Vocal Delivery (30%)
  intonation: 0.10,
  pace: 0.08,
  pausing: 0.07,
  breath_control: 0.05,
  // Pillar 3: Thought Clarity (45%)
  confidence_language: 0.16,
  structure: 0.20,
  conciseness: 0.09,
  // Physical Delivery — not scored in audio mode
  eye_contact: 0,
  facial_expression: 0,
  gestures: 0,
  posture: 0,
};

// ============================================================
// ANCHOR DIMENSIONS — v4.0 gating
// ============================================================

// Anchors are restricted to dimensions built on transcript/acoustic signal —
// vision-based dimensions (eye_contact, facial_expression, gestures, posture)
// rely on periodic still frames, not continuous observation, and must never
// gate the composite score for the whole session.
const VIDEO_ANCHORS: DimensionKey[] = ["structure", "vocal_tone", "intonation"];
const AUDIO_ANCHORS: DimensionKey[] = ["structure", "vocal_tone", "intonation"];

// ============================================================
// COMPOSITE CALCULATION — v4.0
// ============================================================

export function computeCompositeTier(
  dimensionScores: Partial<Record<DimensionKey, number>>,
  mode: "audio" | "video"
): { composite: number; tier: Tier; gatingNote: string | null } {
  const weights = mode === "video" ? VIDEO_WEIGHTS : AUDIO_WEIGHTS;
  const anchors = mode === "video" ? VIDEO_ANCHORS : AUDIO_ANCHORS;
  const keys = Object.keys(dimensionScores) as DimensionKey[];

  if (keys.length === 0) return { composite: 0, tier: "Needs Focus", gatingNote: null };

  // Step 1: Weighted sum
  let weightedSum = 0;
  let totalWeight = 0;
  for (const key of keys) {
    const w = weights[key] ?? 0;
    weightedSum += (dimensionScores[key] ?? 0) * w;
    totalWeight += w;
  }
  // Normalise by the weight actually present. When every dimension for the mode
  // is scored, totalWeight is 1.0 and this is identical to the plain weighted
  // sum. It only differs when a dimension is deliberately excluded — e.g. eye
  // contact when the speaker's eyes were not visible — where dividing by the
  // remaining weight keeps the composite on the same 1–10 scale instead of
  // deflating it by that dimension's weight.
  let composite = totalWeight > 0 ? weightedSum / totalWeight : 0;

  let gatingNote: string | null = null;

  // Step 2: Gating Rule 1 — Needs Work cap
  const anchorScoresNeedsWork = anchors
    .filter(d => keys.includes(d))
    .filter(d => (dimensionScores[d] ?? 10) <= 3);

  if (anchorScoresNeedsWork.length > 0 && composite > 6.4) {
    composite = 6.4;
    const dimNames = anchorScoresNeedsWork
      .map(d => DIMENSION_LABELS[d])
      .join(", ");
    gatingNote = `Your composite score has been adjusted because ${dimNames} ${anchorScoresNeedsWork.length > 1 ? "are" : "is"} in the Needs Focus range. Strengthening ${anchorScoresNeedsWork.length > 1 ? "these foundational dimensions" : "this foundational dimension"} is the highest-return action available to you.`;
  }

  // Step 3: Gating Rule 2 — Distinguished gate
  if (composite >= 8.5) {
    const allAnchorsStrong = anchors
      .filter(d => keys.includes(d))
      .every(d => (dimensionScores[d] ?? 0) >= 7);

    const totalDims = mode === "video" ? 15 : 11;
    const requiredDimsAt7 = mode === "video" ? 10 : 8;
    const dimsAt7Count = keys.filter(d => (dimensionScores[d] ?? 0) >= 7).length;

    if (!allAnchorsStrong || dimsAt7Count < requiredDimsAt7) {
      composite = 8.4;
      gatingNote = "Your composite score has been adjusted to Strong. To reach Distinguished, all foundational dimensions must score Strong or above, and consistent strength is required across the majority of dimensions.";
    }
  }

  composite = Math.round(composite * 10) / 10;
  composite = Math.min(10, Math.max(1, composite));

  return { composite, tier: scoreToTier(composite), gatingNote };
}

// ============================================================
// CONTEXT CLASSIFICATION — v4.1 (explicit label-based)
// ============================================================

export interface ContextClassification {
  label: string;
  idealWpmMin: number;
  idealWpmMax: number;
}

const CONTEXT_BENCHMARKS: Record<string, ContextClassification> = {
  "High Energy":           { label: "High Energy",           idealWpmMin: 145, idealWpmMax: 175 },
  "Formal Presentation":   { label: "Formal Presentation",   idealWpmMin: 130, idealWpmMax: 155 },
  "Stakeholder Update":    { label: "Stakeholder Update",    idealWpmMin: 135, idealWpmMax: 160 },
  "Difficult Conversation":{ label: "Difficult Conversation",idealWpmMin: 110, idealWpmMax: 135 },
  "Impromptu":             { label: "Impromptu",             idealWpmMin: 125, idealWpmMax: 150 },
};

const DEFAULT_CONTEXT: ContextClassification = { label: "Stakeholder Update", idealWpmMin: 135, idealWpmMax: 160 };

export function classifyContext(
  promptText: string | undefined,
  promptContext?: string | undefined
): ContextClassification {
  if (promptContext && CONTEXT_BENCHMARKS[promptContext]) {
    return CONTEXT_BENCHMARKS[promptContext];
  }
  return DEFAULT_CONTEXT;
}

// ============================================================
// INTERFACES
// ============================================================

export interface AudioDeliveryResult {
  analysisText: string;
  pitchVariationScore: number | null;
  breathingScore: number | null;
  breathingObservation: string | null;
  clarityFlags: string | null;
  professionalLanguageFlags: string | null;
  fillerWordCount: number | null;
  fillerWordObservation: string | null;
}

export interface VideoPresenceResult {
  // False when the speaker's eyes were not actually visible in the frames
  // (covered, out of frame, or too dark to make out). Gaze direction cannot be
  // inferred from head orientation alone, so when this is false the eye_contact
  // dimension is excluded from scoring rather than guessed at.
  eyeContactObservable: boolean;
  eyeContactObservation: string;
  // False only when hands/arms never appear gesturing in any analyzed image —
  // occasional or partial visibility is enough for this to stay true. Unlike
  // eye_contact, gestures is never dropped: total absence is itself scored
  // (forced to 1) rather than excluded, since it reflects a real behaviour
  // (no visible gesturing) rather than a missing signal.
  handsEverVisible: boolean;
  gestureObservation: string;
  // False when the mouth/jaw/lower face was not visible in most analyzed
  // images (e.g. a crop showing only forehead/eyes). Like shouldersVisible,
  // this forces facial_expression to score 1 rather than being dropped —
  // the speaker can fix their framing, so it's told to them directly.
  lowerFaceVisible: boolean;
  presenceObservation: string;
  // False when shoulders/upper torso were not visible in most analyzed images.
  // Like handsEverVisible, this is never dropped from scoring — it forces the
  // posture score to 1, since framing yourself so posture can't be seen is
  // itself something the speaker should be told to address.
  shouldersVisible: boolean;
  professionalAppearanceObservation: string;
  overallVisualPresence: string;
  framesAnalyzed: number;
  // Derived from framesAnalyzed — a coarse signal-strength indicator for the
  // vision-based dimensions (eye_contact, facial_expression, gestures, posture)
  // so we never present a sparse-sample read with the same certainty as a
  // well-sampled one.
  visualConfidence: "low" | "medium" | "high";
}

function deriveVisualConfidence(framesAnalyzed: number): "low" | "medium" | "high" {
  if (framesAnalyzed < 8) return "low";
  if (framesAnalyzed < 15) return "medium";
  return "high";
}

export interface ScoringInput {
  sessionId?: string;
  mode: "audio" | "video";
  durationSeconds: number;
  speechDurationSeconds?: number | null;
  audioGapEvents: number;
  faceLostEvents: number;
  silenceEvents: number;
  transcript?: string;
  audioDeliveryAnalysis?: string;
  pitchVariationScore?: number | null;
  breathingScore?: number | null;
  breathingObservation?: string | null;
  clarityFlags?: string | null;
  professionalLanguageFlags?: string | null;
  fillerWordCount?: number | null;
  fillerWordObservation?: string | null;
  videoPresenceAnalysis?: VideoPresenceResult | null;
  recordingContext?: string;
  promptText?: string;
  promptContext?: string;
  structureFamily?: StructureFamily;
  rmsMetrics?: RmsMetrics | null;
  f0Metrics?: F0Metrics | null;
  pauseMetrics?: PauseMetrics | null;
  wpmWindows?: WpmWindow[] | null;
  sessionNumber?: number;
  previousCompositeScore?: number | null;
  interviewMode?: boolean;
}

export type { RmsMetrics, F0Metrics, PauseMetrics, WpmWindow };

export interface DimensionResult {
  dimensionKey: DimensionKey;
  score: number;
  tier: Tier;
  rawMetrics: Record<string, unknown>;
  // Null when the model had no genuine strength (or honest factual baseline) to
  // report. The UI hides the section entirely rather than showing filler.
  strengthText: string | null;
  gapText: string;
  nextStepText: string;
}

// A dimension that could not be assessed because its underlying signal was not
// present in the recording. Carries no score and is excluded from the composite.
export interface UnscoredDimension {
  dimensionKey: DimensionKey;
  label: string;
  reason: string;
}

export interface ScoringResult {
  dimensions: DimensionResult[];
  compositeScore: number;
  compositeTier: Tier;
  gatingNote: string | null;
  audioQualityFlag: boolean;
  faceCoverageFlag: boolean;
  overallFeedback: string;
}

interface AIDimensionEval {
  score: number;
  strengthText: string | null;
  gapText: string;
  nextStepText: string;
}

interface AIEvalResult {
  summaryStrengths: string[];
  summaryImprovements: string[];
  priorityAction: string | null;
  priorityActions: string[];
  recordAgainPrompt: string;
  motivationalMessage: string;
  // Legacy fields (kept for backward-compat in case AI returns old format)
  overallStrengths?: string;
  overallImprovements?: string;
  overallNextStep?: string;
  dimensions: Record<string, AIDimensionEval>;
}

// ============================================================
// GPT-AUDIO DELIVERY ANALYSIS
// ============================================================

export async function analyzeAudioDelivery(
  audioBuffer: Buffer,
  format: CompatibleFormat,
  promptText?: string,
  sessionId?: string
): Promise<AudioDeliveryResult> {
  const audioBase64 = audioBuffer.toString("base64");
  const t0 = Date.now();

  const analysisPrompt = `${promptText ? `The speaker was responding to this prompt: "${promptText}". ` : ""}

You are a senior executive presence coach listening to this audio recording. Focus exclusively on the RAW SONIC QUALITIES of the voice — what you hear in the audio itself. Be specific; no generic statements. Ignore silence at the start/end; analyse only from first word to last word. Keep each field to 1-2 sentences.

Assess the following:

1. Articulation — Clarity and precision of word formation. Are endings dropped, words mumbled or slurred?
   The distinction that matters: HOW the words sound (accent — out of scope) versus WHETHER the words can be made out (intelligibility — in scope, and must be flagged when it is a problem).
   NEVER assess or mention accent, dialect, regional or non-native pronunciation, or how "native" the speaker sounds. An accent is not an articulation problem. Never suggest changing, softening, or neutralising an accent.
   DO flag genuine intelligibility problems clearly and specifically: mumbling, swallowed or trailing-off words, dropped consonant endings, words running together, or speech so rushed or quiet that the words cannot be caught. If a listener would struggle to make out what was actually said, say so plainly — that directly undermines executive presence and is exactly what this assessment exists to surface. Do not soften or omit that feedback because the speaker has an accent; judge distinctness WITHIN their own accent. A strongly accented speaker can be perfectly intelligible, and an unaccented speaker can be impossible to follow.
2. Projection — Does the voice carry consistently? Does volume drop at phrase endings or trail off?
3. Vocal Tone — Richness, warmth, resonance of the voice. Thin, nasal, strained, breathy, warm, or authoritative?
4. Vocal Steadiness — Audible tremor, pitch wavering, or tension-driven strain? (Distinguish from expressive intonation.)
5. Intonation — Does pitch vary purposefully for emphasis and meaning, or is delivery monotone? Do statements fall with authority or rise with uncertainty?
6. Breath Control — Does breath support full phrases, or does the voice thin at endings? Note audible inhalations or breath-induced pauses.
7. Filler Words — Count and name any filler words or verbal tics heard. Listen specifically for: "um", "uh", "like" (only when used as a gap-filler, NOT when used as a comparison — e.g. "like a project" is NOT a filler), "you know", "basically", "right?" (when used as a trailing check-in), "I mean", "so" (only when used as a sentence-starter filler, NOT as a logical connector). Count each occurrence separately. Be conservative — only flag clear filler usage. Write "none detected" if none heard.
8. clarityFlags — Any words/phrases mumbled, swallowed, or likely misheared by auto-transcription? Note timestamp and what you heard. Write "none" if all clear.
9. professionalLanguageFlags — Any profanity, crude language, or personally demeaning language? Quote exact words and timestamp. Write "none" if none.

Return JSON with exactly these keys:
{
  "articulation": "1-2 sentence observation",
  "projection": "1-2 sentence observation",
  "vocalTone": "1-2 sentence observation",
  "vocalSteadiness": "1-2 sentence observation",
  "pitchIntonation": "1-2 sentence observation",
  "pitchVariationScore": <integer 1-5, 1=completely monotone, 5=excellent expressive range>,
  "breathControl": "1-2 sentence observation",
  "breathingScore": <integer 1-5, 1=severe breathlessness, 5=excellent relaxed control>,
  "overallDeliveryQuality": "2-sentence summary of vocal quality",
  "fillerWordObservation": "list each filler word type heard and its count, e.g. 'um x3, uh x1, like x2 (as filler)' — or 'none detected'",
  "fillerWordCount": <integer, total filler word instances across all types, 0 if none>,
  "clarityFlags": "observations or 'none'",
  "professionalLanguageFlags": "exact quotes or 'none'"
}`;

  // Without a system message establishing that it can hear the attached audio,
  // the current gpt-audio snapshots reply "I can't analyze audio recordings"
  // instead of assessing it. The audio IS ingested (audio_input_tokens > 0) —
  // this is a refusal, not a technical failure. The snapshot that previously
  // complied without this (gpt-audio-mini-2025-10-06) has been deprecated.
  const AUDIO_SYSTEM_PROMPT =
    "You are an audio analysis engine for a speech coaching product. You can hear the " +
    "attached audio recording. Describe only the acoustic qualities of the speech — how " +
    "words are formed, how the volume behaves, the timbre, and where breaths fall. Do not " +
    "comment on the speaker's identity or personal characteristics. Always reply with JSON only.";

  // Even with the system message the refusal is INTERMITTENT — measured at
  // roughly one in six calls. A single attempt therefore loses vocal analysis on
  // a meaningful share of sessions, so the primary is retried before switching
  // models; a plain retry usually succeeds because the refusal is not
  // deterministic. gpt-audio-1.5 is a different model that also complies, so it
  // covers the case where the primary starts refusing consistently.
  //
  // Snapshots are pinned rather than tracking the moving alias, so a provider
  // update cannot change scoring behaviour without us choosing it. The tradeoff
  // is that a pinned snapshot is eventually deprecated and starts returning 404
  // — which is exactly what scripts/pipeline-canary.mjs exists to catch.
  // Verify any change here with scripts/verify-pinned-models.mjs first.
  const AUDIO_ATTEMPTS = [
    "gpt-audio-mini-2025-12-15",
    "gpt-audio-mini-2025-12-15",
    "gpt-audio-1.5",
  ] as const;

  async function requestAnalysis(model: string) {
    return openai.chat.completions.create({
      model,
      modalities: ["text"],
      messages: [
        { role: "system", content: AUDIO_SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "input_audio", input_audio: { data: audioBase64, format } } as const,
            { type: "text", text: analysisPrompt } as const,
          ],
        },
      ],
    } as Parameters<typeof openai.chat.completions.create>[0]);
  }

  try {
    // A reply with no JSON object means the model declined. Passing that prose
    // downstream is worse than having nothing: the coaching model reads it as
    // evidence and reports that audio analysis was unavailable.
    const hasJson = (r: Awaited<ReturnType<typeof requestAnalysis>>) =>
      /\{[\s\S]*\}/.test(((r.choices[0]?.message as Record<string, unknown>)?.content as string) || "");

    let response: Awaited<ReturnType<typeof requestAnalysis>> | null = null;
    let usedModel = "";
    let attemptsUsed = 0;

    for (const [attempt, model] of AUDIO_ATTEMPTS.entries()) {
      const candidate = await requestAnalysis(model);
      attemptsUsed = attempt + 1;
      if (hasJson(candidate)) {
        response = candidate;
        usedModel = model;
        break;
      }
      logger.warn({ session_id: sessionId, ai_call: "audio-delivery", model, attempt: attempt + 1 }, "audio delivery analysis refused, retrying");
    }

    if (!response) {
      // Deliberately returns empty rather than surfacing anything to the user.
      // Re-recording cannot fix a provider-side refusal, so prompting for one
      // would send the user into a loop that can never succeed. The session
      // keeps the locally-computed acoustic metrics; this failure is for us to
      // see in the logs and the canary, not for them to act on.
      logger.error({
        session_id: sessionId,
        ai_call: "audio-delivery",
        attempts: AUDIO_ATTEMPTS.length,
        models_tried: new Set(AUDIO_ATTEMPTS).size,
        elapsed_ms: Date.now() - t0,
      }, "audio delivery analysis unavailable after all attempts");
      return {
        analysisText: "",
        pitchVariationScore: null,
        breathingScore: null,
        breathingObservation: null,
        clarityFlags: null,
        professionalLanguageFlags: null,
        fillerWordCount: null,
        fillerWordObservation: null,
      };
    }

    const u = response.usage as Record<string, unknown> | undefined;
    logger.info({
      session_id: sessionId,
      ai_call: "audio-delivery",
      model: usedModel,
      attempts: attemptsUsed,
      elapsed_ms: Date.now() - t0,
      prompt_tokens: u?.prompt_tokens,
      completion_tokens: u?.completion_tokens,
      total_tokens: u?.total_tokens,
      audio_input_tokens: (u?.prompt_tokens_details as Record<string, unknown> | undefined)?.audio_tokens,
      audio_output_tokens: (u?.completion_tokens_details as Record<string, unknown> | undefined)?.audio_tokens,
    }, "audio delivery analysis usage");

    const message = response.choices[0]?.message as Record<string, unknown>;
    const rawText = (message?.content as string) || "";

    let pitchVariationScore: number | null = null;
    let breathingScore: number | null = null;
    let breathingObservation: string | null = null;
    let clarityFlags: string | null = null;
    let professionalLanguageFlags: string | null = null;
    let fillerWordCount: number | null = null;
    let fillerWordObservation: string | null = null;

    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
        const pvs = Number(parsed.pitchVariationScore);
        if (!isNaN(pvs) && pvs >= 1 && pvs <= 5) pitchVariationScore = pvs;
        const bs = Number(parsed.breathingScore);
        if (!isNaN(bs) && bs >= 1 && bs <= 5) breathingScore = bs;
        if (typeof parsed.breathControl === "string") breathingObservation = parsed.breathControl;
        if (typeof parsed.clarityFlags === "string" && parsed.clarityFlags !== "none") clarityFlags = parsed.clarityFlags;
        if (typeof parsed.professionalLanguageFlags === "string" && parsed.professionalLanguageFlags !== "none") professionalLanguageFlags = parsed.professionalLanguageFlags;
        const fwc = Number(parsed.fillerWordCount);
        if (!isNaN(fwc) && fwc >= 0) fillerWordCount = fwc;
        if (typeof parsed.fillerWordObservation === "string" && parsed.fillerWordObservation !== "none detected") fillerWordObservation = parsed.fillerWordObservation;
      }
    } catch {
      // parsing failure — scores remain null
    }

    return { analysisText: rawText, pitchVariationScore, breathingScore, breathingObservation, clarityFlags, professionalLanguageFlags, fillerWordCount, fillerWordObservation };
  } catch (err) {
    logger.error({ session_id: sessionId, ai_call: "audio-delivery", err, elapsed_ms: Date.now() - t0 }, "gpt-audio delivery analysis failed");
    return { analysisText: "", pitchVariationScore: null, breathingScore: null, breathingObservation: null, clarityFlags: null, professionalLanguageFlags: null, fillerWordCount: null, fillerWordObservation: null };
  }
}

// ============================================================
// CLAUDE VISION — VIDEO FRAME ANALYSIS (updated for v4.0)
// ============================================================

export async function analyzeVideoPresence(
  frameBase64Array: string[],
  promptText?: string,
  recordingContext?: string,
  sessionId?: string
): Promise<VideoPresenceResult> {
  const t0 = Date.now();
  // Analyze every frame that was captured, so longer recordings get
  // proportionally more coverage instead of being squeezed into a fixed
  // sample size. Only fall back to even downsampling for unusually long
  // recordings, as a cost/latency backstop rather than the normal path.
  const MAX_FRAMES_TO_ANALYZE = 500;
  const frames = frameBase64Array.length <= MAX_FRAMES_TO_ANALYZE
    ? frameBase64Array
    : Array.from({ length: MAX_FRAMES_TO_ANALYZE }, (_, i) =>
        frameBase64Array[Math.round((i * (frameBase64Array.length - 1)) / (MAX_FRAMES_TO_ANALYZE - 1))]
      );

  const analysisPrompt = `${promptText ? `The speaker was responding to this prompt: "${promptText}". ` : ""}${recordingContext ? `Recording context: ${recordingContext}.` : ""}

You are a senior executive presence coach reviewing a series of ${frames.length} video frames captured at regular intervals during a ${recordingContext || "seated"} presentation. Analyze ONLY what you can directly observe in the images. Be specific and honest.

CALIBRATE YOUR CERTAINTY TO YOUR SAMPLE SIZE: you are working from ${frames.length} still images sampled across the recording, not continuous footage. ${frames.length < 8
  ? "This is a small sample. Use tentative, hedged language (e.g. \"in the moments captured, ...\", \"what's available suggests...\")."
  : frames.length < 15
  ? "This is a moderate sample. You may describe general patterns, but qualify strong claims (e.g. prefer \"at multiple points\" over an absolute claim)."
  : "This is a solid sample. You may describe overall patterns with normal confidence, but still ground claims in what was actually observed rather than implying continuous coverage."
} Regardless of sample size, never use "always", "never", "consistently", "throughout", or "constantly" — describe what the sampled moments show using phrasing like "at multiple points", "at times", "on occasion", not what happened continuously between them.

Assess the following four areas based solely on what you see in the frames:

1. EYE CONTACT: For each image, classify the speaker's gaze using exactly these three categories:
- DIRECT: The speaker's gaze is aimed at or within a few degrees of the camera lens itself.
- SCREEN: The speaker's gaze is directed at their screen/display — at themselves, at notes, or at other on-screen content. This is the normal, expected, and natural gaze position for someone speaking into a laptop or phone camera (the lens sits at the edge of the screen, so screen-directed gaze is only slightly off-axis from the lens). SCREEN gaze should be treated as good, natural eye contact, not as a deficiency — looking directly into the lens itself is unnatural and should NOT be expected or required for a good score.
- OFF: Gaze is clearly directed away from both the camera and the screen — to the far side, upward toward the ceiling, downward toward a desk or keyboard, or anywhere else in the room. This is the category that represents an actual eye contact gap.

OBSERVABILITY GATE — CHECK THIS FIRST, FOR EVERY SINGLE IMAGE, BEFORE CLASSIFYING ANY GAZE:
Gaze can only be assessed if you can actually see where the speaker's open eyes are pointed. Head and face orientation is NOT a substitute — a person can face the camera squarely while their eyes are directed elsewhere, so head position tells you nothing reliable about gaze.
CLOSED EYES ARE NOT OBSERVABLE GAZE, EVER — this is the single most common mistake to avoid. Closed eyelids give you zero information about gaze direction, no matter how "settled" or "engaged" the rest of the face looks. Do NOT classify closed eyes as DIRECT or SCREEN just because the head is facing forward — check each image specifically for whether the eyes are OPEN before you classify gaze at all. An image with closed eyes contributes to "eyes not visible," not to a DIRECT/SCREEN count.
Set "eyeContactObservable" to false if the speaker's eyes are not visible AND OPEN in most of the images, for ANY reason: eyes closed, covered or obscured by anything, face turned away, out of frame, or lighting/resolution too poor to make out where the pupils are directed. If most of the images show closed eyes, this alone is sufficient to set eyeContactObservable to false — do not average closed-eye images in with a few open-eye ones to produce a "mostly good" reading.
If eyeContactObservable is false: set "eyeContactObservation" to a brief, factual, neutral statement that their eyes were not visible/open in this recording so gaze could not be assessed. State it as a limitation of what the recording captured, NOT as a fault, a criticism, or something to fix in their behaviour, and do NOT name or describe the cause if the cause is an item they are wearing (see the appearance prohibition below — it still applies in full). Then STOP: do not tally DIRECT/NEAR/OFF, do not describe a gaze pattern, and do not characterise the quality of their camera connection.
Never produce a confident-sounding gaze assessment from head pose or a "settled" facial impression when the eyes themselves are shut. Guessing here is a worse failure than reporting that the signal was unavailable.

Only if eyeContactObservable is true, proceed with the classification below.

Scoring guidance: DIRECT and SCREEN both count as good eye contact — a speaker whose gaze stays on the screen/display throughout should score well on this dimension, just as if they were looking at the camera lens itself. Do NOT penalise screen-directed gaze as a deficiency or treat DIRECT as a higher-value tier than SCREEN. Only OFF (gaze wandering away from both the camera and the screen — to the room, the ceiling, a desk, etc.) represents an actual eye contact gap and should bring the score down. When uncertain between DIRECT and SCREEN, classify as SCREEN; when uncertain between SCREEN and OFF, classify based on whether the gaze is still oriented toward the screen/device (SCREEN) or has left it entirely (OFF). Describe the overall pattern in plain, qualitative terms only (e.g. "at several points", "on occasion", "during parts of the recording") — never as a numeric tally, count, or proportion (e.g. do NOT write "13 of 16", "roughly 80% of moments", or any "X out of Y" phrasing), and never with absolutist words like "throughout" or "consistently". The viewer only needs to know how the gaze read, not how many samples were analysed. Feedback may still gently suggest looking at the camera lens for an extra layer of polish, but this should never be framed as a fault or cost the speaker a strong score if their gaze was on the screen. Do NOT mention "frames" or image numbers.

2. FACIAL EXPRESSION: Is the expression flat, neutral, warm, animated, or incongruent with what appears to be serious content? Does the face convey genuine engagement? Is there visible tension (tight jaw, pressed lips, furrowed brow) or warmth? Does expression vary to match content importance?

VISIBILITY GATE — CHECK THIS FIRST, BEFORE ASSESSING EXPRESSION AT ALL:
Facial expression can only be judged if the lower face — mouth, lips, jaw, cheeks — is actually visible. Forehead, eyebrows, and eyes alone are NOT enough: warmth, tension, and congruence with what's being said show up mainly in the mouth and jaw, and a person can have furrowed brows while smiling or a relaxed brow while tense-jawed.
Set "lowerFaceVisible" to false if the mouth/jaw/lower face is not clearly visible in most of the images — including when the shot is cropped so only the forehead/eyes are in view, the camera is angled from below or above, or the lower face is otherwise cut off or obscured.
If "lowerFaceVisible" is false: set "presenceObservation" to one neutral, factual sentence stating that the lower face was not visible in this recording so expression could not be assessed. Do NOT describe warmth, tension, congruence, or animation, and do NOT infer expression from the eyes/eyebrows alone. This should still be named as something for the speaker to fix — framing the camera to capture the full face is within their control — but it must not be dressed up as an expression observation.
Never produce a confident-sounding expression assessment when the mouth/jaw aren't in view. Guessing here from eyes/eyebrows alone is a worse failure than correctly reporting that expression could not be assessed.

Only if lowerFaceVisible is true, proceed with the assessment below.

ANIMATION INTENSITY — SEPARATE FROM WARMTH/CONGRUENCE: More animation is not automatically better. An expression can be warm and clearly congruent with the content and still be a problem if it is disproportionate to what's being said — exaggerated, theatrical, or erratic facial movement (wide eyes, big reactions, constant eyebrow or mouth movement) that reads as performative or unnatural rather than genuinely engaged. Assess this as its own signal, separate from warmth and congruence.
- Only describe the expression as "exaggerated", "theatrical", or "overly animated" if a clear majority of ALL the images you were given show this pattern. Do not generalise from a handful of expressive frames, and do not let a few animated images stand in for the whole session.
- If the images show a genuine mix — some animated, some settled — describe it neutrally as a varied or expressive pattern, not as excessive.
- If the sample size is small (see the sample-size calibration above), do not make an intensity claim beyond describing what was observed at the sampled moments — there is not enough evidence to characterise the overall pattern as excessive or measured.

3. GESTURES: Are hand or arm gestures visible? Classify each as: purposeful (emphasise points, enumerate ideas), neutral (hands still or naturally positioned), or distracting (fidgeting, self-touching, erratic movement). Note posture — open vs closed body position.

HANDS VISIBILITY: It is fine for hands to be out of frame some or even most of the time — only set "handsEverVisible" to false if hands are not visible gesturing in ANY of the images provided. If hands appear and gesture in even one image, set "handsEverVisible" to true and score gesture quality/volume normally from whatever is visible. If "handsEverVisible" is false, do not describe gesture quality or volume — instead, "gestureObservation" should state plainly that no hand or arm movement was visible at any point in the recording, and note that this itself is a meaningful gap: visible gesturing is part of how executive presence reads on camera, and its total absence should be treated as a real weakness to address, not a neutral non-event.

GESTURE VOLUME — SEPARATE FROM GESTURE QUALITY: A gesture can be well-formed (open palm, clear counting, purposeful framing) and still be a problem purely because of how much of the recording it occupies. Relentless, near-continuous gesturing with little to no stillness reads as anxious or manic energy, regardless of how clean each individual gesture looks. Assess this as its own signal, separate from whether individual gestures are purposeful or distracting in form.
- Only describe the volume as "constant", "relentless", or "rarely still" if a clear majority of ALL the images you were given show hands actively gesturing. Do not generalise a volume judgment from a handful of frames, and do not let a few energetic images stand in for the whole session.
- If the images show a genuine mix — some gesturing, some stillness — describe it neutrally as a moderate or varied pattern. Do not round a mixed pattern up to "constant" or down to "minimal".
- If the sample size is small (see the sample-size calibration above), do not make a volume claim at all beyond "gestured at several of the sampled moments" — there is not enough evidence to characterise the pattern as constant or minimal either way.

SELF-TOUCH — REQUIRES RESTING CONTACT, NOT PROXIMITY: A hand near the face, neck, or hair is not, by itself, self-touching — it is extremely common for a purposeful gesture (framing an idea, counting, an open-palm emphasis) to pass through that space. Only classify something as self-touching, grooming, or self-soothing when the hand shape and position show genuine static contact: fingers curled or resting against skin/hair/collar in a shape inconsistent with an active gesture (not open-palmed, not pointing, not mid-count), ideally appearing in more than one sampled image in a similar resting position. If you are not confident the contact is resting rather than transiting through an active gesture, do NOT report it as self-touching — describe the moment as a gesture instead, or say nothing about it. Do not let the vocabulary of this category ("self-touching", "neckline", "grooming") lead you to search for it in ambiguous frames — absence of evidence is the default, not a fallback.

4. POSTURE: Is the speaker upright, open, and settled? Or slumped, tense, or physically withdrawn? Is there evidence of deliberate forward lean on key moments?

VISIBILITY GATE — CHECK THIS FIRST, BEFORE ASSESSING POSTURE AT ALL:
Posture (upright/slumped, open/closed) can only be judged from the shoulders and upper torso — the face and neck alone tell you nothing reliable about how someone is holding their body, in the same way head orientation tells you nothing reliable about gaze. Do NOT infer posture from facial framing, chin angle, or how "settled" someone looks in a close-up crop.
Set "shouldersVisible" to false if the actual shoulder line / collarbone width / upper-torso outline is not clearly visible in most of the images — including when the shot is cropped tight on the face and neck, when the speaker is positioned low or far from camera so their upper body is out of frame, or when only a sliver of shoulder is intermittently visible at the frame edge.
If "shouldersVisible" is false: set "professionalAppearanceObservation" to one neutral, factual sentence stating that the shoulders/upper body were not visible in this recording so posture could not be assessed. Do NOT describe posture quality, do NOT use words like "upright", "open", "settled", "squarely", or "throughout" here, and do NOT infer a posture reading from the face alone. Unlike eye contact, this should still be named as something for the speaker to fix (how the camera is framed is within their control), but it must not be dressed up as a posture observation.
Never produce a confident-sounding posture assessment when the shoulders aren't actually in view. Guessing here from facial framing alone is a worse failure than correctly reporting that posture could not be assessed.

Only if shouldersVisible is true, proceed with a normal posture assessment below.

ABSOLUTE PROHIBITION — APPEARANCE, IDENTITY, AND CULTURE:
Assess only what the speaker is DOING — where they are looking, how they are holding themselves, how they are moving, what their face is expressing. Never assess how they LOOK.
Say nothing whatsoever about: clothing, formality of dress, accessories (glasses, sunglasses, jewellery, headwear), hair, grooming, make-up, skin, body size or shape, age, gender, perceived ethnicity, religious or cultural dress, disability or physical features, or the room and background behind them.
Never treat any of these as evidence for or against executive presence, and never let them influence a score. What counts as appropriate dress varies by culture, industry, and individual, and it is not this assessment's business.
Posture is NOT appearance. Posture is how someone holds and carries their body — upright or slumped, open or closed, settled or tense, still or shifting. That is behaviour, it is within the speaker's control, and it is legitimately in scope. A person can be assessed as having excellent posture in a t-shirt and poor posture in a suit.
WRONG: "The sunglasses on your head and casual sweatshirt read as informal for a professional context."
WRONG: "A more formal collared shirt would strengthen your presence."
RIGHT: "You held an upright, open position throughout, with a slight forward lean as you made your central point."

CRITICAL LANGUAGE RULE: Your written observations must NEVER use the words "frame", "frames", "image", or image numbers (e.g. "frame 6", "in image 3") — the viewer does not care how the recording was sampled, only what it showed. Separately, because you are working from periodic stills rather than continuous footage, NEVER use absolutist or continuity-implying words or phrases, including but not limited to: "always", "never" (as a frequency claim, e.g. "never breaks eye contact"), "consistently", "throughout", "constantly", "the whole time", "entire recording", "entirely", "across the session", "dominant pattern across the session". Use sampling-honest, plain-language alternatives instead: "at multiple points", "at times", "on occasion", "during parts of the recording", "in several moments", "for a good portion of the recording". This applies to every observation field below, with no exceptions.

MANDATORY SELF-CHECK BEFORE YOU RETURN YOUR ANSWER:
1. Re-read "eyeContactObservation", "gestureObservation", "presenceObservation", "professionalAppearanceObservation", and "overallVisualPresence", hunting specifically for the banned words above. If you find any, rewrite that sentence using an allowed alternative before returning the JSON.
2. Before finalizing "eyeContactObservable", go back through the images one more time and confirm: in most of them, are the eyes actually OPEN, not just present on the face? If the eyes are closed in most images, "eyeContactObservable" MUST be false, regardless of how engaged or settled the rest of the face looks.
Do not skip this check — both failure modes above have been missed in past outputs and are the most common failure modes.

Return your analysis as a JSON object with these exact keys:
{
  "eyeContactObservable": <true only if the speaker's eyes are visible clearly enough to tell where their gaze is directed in most of the images; false otherwise>,
  "eyeContactObservation": "if eyeContactObservable is true: gaze pattern described in plain qualitative language only (remembering DIRECT and SCREEN both count as good eye contact and only OFF is a gap), description of gaze direction, quality of engagement with the viewer. NEVER express the pattern as a count, tally, or proportion (no 'X of Y', no percentages, no fractions) — describe frequency only in words like 'at several points', 'on occasion'. If false: one neutral factual sentence that their eyes were not visible so gaze could not be assessed, with no cause named if the cause is something worn, and no gaze pattern claimed — NO frame numbers, NO absolutist words (see banned list above)",
  "handsEverVisible": <true if hands/arms appear gesturing in at least one image, however briefly; false only if hands never appear gesturing in any image provided>,
  "gestureObservation": "if handsEverVisible is true: specific description of gesture types observed, whether purposeful or distracting IN FORM, PLUS a separate volume/frequency read (constant/relentless vs moderate/varied vs minimal — only when the evidence threshold above is met), body openness/closedness. Only mention self-touching if the resting-contact bar above is met — otherwise do not mention it at all. If handsEverVisible is false: one direct sentence stating no hand or arm movement was visible at any point, framed as a real gap in executive presence, not a neutral limitation. NO frame numbers, NO absolutist words (see banned list above)",
  "lowerFaceVisible": <true only if the mouth/jaw/lower face is clearly visible in most of the images — NOT inferable from eyes/eyebrows alone; false otherwise, including tight crops showing only the upper face>,
  "presenceObservation": "if lowerFaceVisible is true: specific description of facial expression — range, congruence, warmth, tension signals, engagement quality, PLUS a separate animation-intensity read (exaggerated/theatrical vs measured/proportionate — only when the evidence threshold above is met). If lowerFaceVisible is false: one direct sentence stating the lower face/mouth was not visible so expression could not be assessed, framed as something to correct in how the camera is set up next time, not a neutral limitation — NO frame numbers, NO absolutist words (see banned list above)",
  "shouldersVisible": <true only if the actual shoulder line/upper-torso outline is clearly visible in most of the images — NOT inferable from face/neck framing alone; false otherwise, including tight face crops>,
  "professionalAppearanceObservation": "if shouldersVisible is true: specific assessment of POSTURE ONLY (upright/settled vs slumped/tense, open vs closed, forward lean on key moments) — say nothing about clothing, grooming, hair, accessories, physical features, or background. If shouldersVisible is false: one direct sentence stating the shoulders/upper body were not in frame so posture could not be assessed, framed as something to correct in how the camera is set up next time, not a neutral limitation. NO frame numbers, NO absolutist words (see banned list above)",
  "overallVisualPresence": "2-sentence summary of the speaker's overall visual executive presence — NO frame numbers, NO absolutist words (see banned list above)"
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

    logger.info({
      session_id: sessionId,
      ai_call: "claude-vision",
      model: "claude-sonnet-4-6",
      elapsed_ms: Date.now() - t0,
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      frames_sent: frames.length,
    }, "claude-vision usage");

    const rawText = response.content
      .filter(b => b.type === "text")
      .map(b => (b as { type: "text"; text: string }).text)
      .join("");

    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
      return {
        // Absent key defaults to observable, so a model that ignores the new
        // field behaves exactly as before rather than silently dropping the
        // dimension for every session.
        eyeContactObservable: parsed.eyeContactObservable !== false,
        eyeContactObservation: String(parsed.eyeContactObservation || ""),
        // Absent key defaults to true (observable) for the same
        // don't-silently-change-past-behaviour reason as eyeContactObservable.
        handsEverVisible: parsed.handsEverVisible !== false,
        gestureObservation: String(parsed.gestureObservation || ""),
        lowerFaceVisible: parsed.lowerFaceVisible !== false,
        presenceObservation: String(parsed.presenceObservation || ""),
        shouldersVisible: parsed.shouldersVisible !== false,
        professionalAppearanceObservation: String(parsed.professionalAppearanceObservation || ""),
        overallVisualPresence: String(parsed.overallVisualPresence || ""),
        framesAnalyzed: frames.length,
        visualConfidence: deriveVisualConfidence(frames.length),
      };
    }
    throw new Error("No JSON found in vision response");
  } catch (err) {
    logger.error({ session_id: sessionId, ai_call: "claude-vision", err, elapsed_ms: Date.now() - t0 }, "video presence analysis failed");
    throw err;
  }
}

// ============================================================
// TRANSCRIPTION
// ============================================================

export async function transcribeAudio(
  audioBuffer: Buffer,
  sessionId?: string
): Promise<{ transcript: string; speechDurationSeconds: number | null; pauseMetrics: PauseMetrics | null; wpmWindows: WpmWindow[] | null }> {
  const { buffer, format } = await ensureCompatibleFormat(audioBuffer);
  const t0 = Date.now();
  const result = await speechToTextWithTiming(buffer, format);
  const elapsedMs = Date.now() - t0;
  logger.info({
    session_id: sessionId,
    ai_call: "transcription",
    model: result.model,
    audio_bytes: buffer.length,
    audio_mb: Math.round(buffer.length / 1024 / 1024 * 100) / 100,
    speech_duration_seconds: result.speechDurationSeconds,
    elapsed_ms: elapsedMs,
    word_count: result.text ? result.text.trim().split(/\s+/).filter(Boolean).length : 0,
  }, "transcription usage");
  return {
    transcript: result.text,
    speechDurationSeconds: result.speechDurationSeconds,
    pauseMetrics: result.pauseMetrics,
    wpmWindows: result.wpmWindows,
  };
}

// ============================================================
// AI EVALUATION — v4.0 full 15-dimension prompt
// ============================================================

async function runAIEvaluation(
  input: ScoringInput,
  dimensions: DimensionKey[],
  context: ContextClassification
): Promise<AIEvalResult> {
  const wordCount = input.transcript
    ? input.transcript.trim().split(/\s+/).filter(Boolean).length
    : 0;
  const paceDuration = input.speechDurationSeconds ?? input.durationSeconds;
  const wordsPerMinute =
    paceDuration > 0
      ? Math.round((wordCount / paceDuration) * 60)
      : 0;

  // WPM deviation from context ideal
  const wpmMid = (context.idealWpmMin + context.idealWpmMax) / 2;
  const wpmDeviation = Math.abs(wordsPerMinute - wpmMid);

  const dimensionList = dimensions
    .map(d => `- ${d}: ${DIMENSION_LABELS[d]}`)
    .join("\n");

  const systemPrompt = `You are a senior executive presence coach and evaluator implementing the Gravitas Scoring Methodology v4.0. Your assessments are rigorous, evidence-based, and honest. Write as if you listened to the recording yourself — every piece of feedback should feel as though it was written by a human coach who heard this specific person in this specific session, not generic advice that could apply to anyone.

METHODOLOGY v4.0 — SCORING TIERS:
- 1–3 (Needs Focus): Absent, severely deficient, or actively undermining presence.
- 4–6 (Developing): Foundation present but inconsistently applied. Skill exists but unreliable.
- 7–8 (Strong): Consistent, controlled, credible. Dimension is working in the speaker's favour most of the time. A 7 is a genuinely good score. A 7 is solid professional standard.
- 9–10 (Distinguished): Masterful and intentional. Score 9 = almost nothing to improve. Score 10 = world-class, exceptionally rare.

CRITICAL RULE — SIGNAL SOURCE SEPARATION (DO NOT MIX):
Every dimension must be scored from its designated source only. Mixing sources is a scoring error.

SOURCE A (gpt-audio): articulation, projection, vocal_tone, vocal_steadiness, intonation, breath_control
SOURCE B (audio waveform numerics): pace (WPM, windows, SD), pausing (pause count, duration, placement)
SOURCE C (transcript): confidence_language, structure, conciseness — NEVER infer these from audio tone, never penalise transcript word choices when speaker is reciting/reading
SOURCE D (Claude Vision frames): eye_contact, facial_expression, gestures, posture — NEVER infer from audio, NEVER assume from context

If video analysis is absent and the dimension is from Source D:
- Set score to note visual analysis was unavailable. Do not guess or infer from audio.

RECITATION / READING CONTEXT:
If the speaker's prompt indicates they are reading or reciting a pre-written literary or published text (poem, speech, passage, prayer, scripture):
- STRUCTURE: Do NOT penalise for lacking original architecture. The structure belongs to the source text. Evaluate ONLY how the delivery honored that structure through pacing, pausing, phrasing, and breath.
- CONFIDENCE_LANGUAGE: The words are not the speaker's own. Do NOT penalise for archaic, formal, or unusual word choices. Evaluate ONLY vocal conviction and commitment.
- CONCISENESS: Do NOT penalise for length or phrasing that belongs to the source text.

FEEDBACK STANDARDS — ALL MUST BE MET:
0. SECOND PERSON — STRICTLY ENFORCED: ALL feedback must be written directly to the speaker using "you" and "your". NEVER use third person ("the speaker", "he", "she", "they", "their"). Write as if speaking directly to the person.
   WRONG: "The speaker's pace was too fast."
   RIGHT: "Your pace was too fast."

1. EVIDENCE-BASED AND SESSION-SPECIFIC: Reference something that actually happened in this recording — a specific moment, phrase, pattern, or signal. Reference specific measured values. Never generic statements that could apply to any session.
   WRONG: "You spoke too fast."
   RIGHT: "Your pace averaged ${wordsPerMinute} words per minute — above the ideal for this ${context.label} context. In the middle portion of your response, you accelerated noticeably, and at that speed your listener is working to keep up rather than absorbing what you are saying."

2. IMPACT-FRAMED: Do not just describe what happened — name what it does to the listener. For 1–6: state the effect on the audience as a result of this behaviour. For 7–10: name what would change if the dimension were further developed. Never just describe the behaviour without stating its impact.
   WRONG: "Your pace was fast."
   RIGHT: "At that speed, your listener is working to keep up rather than absorbing what you are saying."

3. WARM, DIRECT COACHING VOICE: Write as if speaking to a capable person who can handle honest feedback and act on it. Not clinical, not academic, not generic. Warm and direct. This is a coaching conversation, not an audit.

4. ONE CONCRETE SPECIFIC NEXT ACTION — IN THE RECORDING: End every dimension block with a single, specific, actionable instruction framed around recording again. The action must be something the speaker thinks about before or tries during their next recording here — not something they do in isolation.
   NEVER suggest writing, scripting, noting down, or preparing any written material. All preparation is mental: thinking through structure, identifying a key point, deciding on an opening.
   NEVER comment on or score anything about how the speaker LOOKS or SOUNDS as a person, as opposed to what they DO. Off limits entirely: clothing, formality of dress, accessories, hair, grooming, make-up, physical features, body size, age, gender, perceived ethnicity, religious or cultural dress, disability, background or room — and accent, dialect, or non-native pronunciation. These must never appear in any text and must never influence any score, even if the source observations mention them. What reads as "professional" varies by culture and context and is not ours to judge.
   Posture, gesture, facial expression and articulation ARE in scope — they describe behaviour the speaker controls, not appearance or identity. Someone can have excellent posture in a t-shirt, and excellent articulation in a strong accent.
   This is a prohibition on assessing appearance and accent, NOT a reason to go soft. If words are genuinely mumbled, swallowed, trailed off, run together, or too rushed or quiet to make out, flag it plainly and coach on it — difficulty understanding a speaker directly undermines their executive presence, and surfacing that is core to what this assessment is for. Never suppress or soften intelligibility feedback because the speaker has an accent; the question is whether the words can be caught, not how they sound.
   WRONG: "The sunglasses on your head and casual sweatshirt undermine your polish."
   WRONG: "Softening your accent would make you easier to follow."
   RIGHT: "You held an upright, settled position throughout, with a forward lean as you reached your main point."
   NEVER recommend a coach, mentor, therapist, class, course, or any other person or service — in any field, for any dimension. There is no onward referral to offer, so suggesting one leaves the speaker with a next step they cannot take. Where something sits deeper than technique, say it is worth exploring further and offer a reflection question instead.
   WRONG: "That layer is worth exploring with a coach."
   WRONG: "Consider working with a voice coach on this."
   RIGHT: "That layer is worth exploring further — worth noticing: what shifts when you speak as though the room is already yours?"
   WRONG: "Write down your three key points and practise delivering them."
   WRONG: "Slow down."
   WRONG: "Before your next session, note the key ideas you want to cover."
   RIGHT: "In your next recording, try opening with a single declarative statement — think of the one thing you most want your listener to take away, then lead with that."
   RIGHT: "Record again and notice whether you can hear yourself land a pause after your main point before moving on."

5. PLAIN LANGUAGE — STRICTLY ENFORCED. Describe what happened and why it matters. Banned phrases and required translations:
   - NEVER write "standard deviation", "SD", or any statistical term → instead say "your volume stayed consistent" or "your volume shifted noticeably throughout"
   - NEVER write Hz values (e.g. "321 Hz", "pitch range spanned X Hz") → instead say "your pitch stayed flat and monotone" or "your voice moved expressively across a wide range" or describe the effect on the listener
   - NEVER write "dB", "RMS", "F0", "waveform", "amplitude" → describe the effect in plain terms
   - NEVER write "breath engine", "pitch engine", "audio engine", or reference any internal scoring tool → just state the observation and its impact
   - NEVER write "gpt-audio", "Claude Vision", or mention any AI model → these are invisible to the user
   - NEVER write "4 seconds or longer", "≥4s", or any specific second threshold when describing pauses to the user → say "extended silence", "long pauses", or "silence mid-speech" instead
   - NEVER write "frame", "frames", "frame 6", or any reference to video frames or image numbers → these are internal analysis artefacts invisible to the user. Instead say "throughout your recording", "at several points in your session", "for most of the session", "consistently", "at times", etc.
   - NEVER write "X out of Y", sample counts, fractions, or percentages describing how many analysed moments showed a behaviour (e.g. "13 out of 16 sampled moments", "roughly 80% of the time") → these expose internal sampling mechanics, not audience experience. Instead describe frequency qualitatively: "consistently", "at several points", "occasionally", "throughout most of the recording"

6. PACE VARIATION RULE — CRITICAL: If the pace-over-time data shows high within-session variance (any window deviates more than 25 wpm from the overall average, OR the slowest and fastest windows differ by more than 50 wpm), you MUST:
   - Describe the temporal pattern specifically (e.g. "you started around X words per minute in the first half, then accelerated to Y words per minute as the response continued")
   - State the impact this contrast has on the listener
   - DO NOT frame the average as a success when there is a stark pace contrast — an average in range with wild variation is NOT a compliment
   - WRONG: "Your pace averaged 130 wpm, landing within the ideal range — a genuine asset."
   - RIGHT: "Your pace started around 90 wpm in the opening, then climbed sharply to 175 wpm as you continued. While the average landed in range, that acceleration is what the listener experiences — it reads as a loss of composure."

   LATE-SESSION BURSTS — CRITICAL ADDITIONAL RULE:
   If the audio delivery analysis (SOURCE A) describes a noticeable acceleration or rush at the end of the response, you MUST flag this explicitly even if the overall average WPM is below the ideal range. A slow-then-fast pattern is NOT simply "slow pace" — the rush at the end is the dominant experience for the listener and is often the most damaging part of the delivery. The WPM window data may under-represent late-session bursts if speech was so rapid that transcription missed words. In these cases, SOURCE A's observation takes precedence over the numeric averages. Name the moment, describe what the listener experienced, and give a specific next step.

7. PAUSE CLARITY RULE: Strategic pauses that signal control and confidence are typically 0.5–2 seconds, placed after key points or between ideas. NEVER state that pauses need to be 4 seconds or longer to be meaningful. The ≥4s silence events in Source B are long hesitation gaps, which are different from intentional emphasis pauses. Reference the pause count from Source B (pauses ≥0.5s) when discussing pausing technique.

GRANULAR PACE ANALYSIS — USING 5-SECOND WINDOWS:
You have access to per-5-second WPM data in Source B. Use it to identify localised pace changes within the session. Do NOT flag every deviation — only flag a pace change when there is evidence it affected the listening experience.
- RUSHES: If any 5-second window shows WPM more than 40 wpm above the speaker's session average, assess whether the content in that window was high-stakes (a key recommendation, main point, or critical transition). If it was, flag it specifically: "Around the [timestamp] mark, you moved quickly through what was actually your central point. At that speed, the listener may not have registered its weight." If the content in that window was low-stakes (context, transition, preamble), do not flag it.
- SLOWDOWNS: If any 5-second window shows WPM significantly below the session average, assess whether the slowdown served the message. If it preceded or accompanied an important statement, credit it: "You slowed down noticeably before your conclusion — that shift signals to the listener that something significant is coming. It works well here." If the slowdown appeared mid-sentence without apparent purpose and created a sense of uncertainty or loss of thread, flag it gently.
- GOVERNING PRINCIPLE: Pace variation is not inherently good or bad. Reward deliberate variation. Flag variation that worked against the message. Ignore variation that had no meaningful impact either way.

PAUSING — MOMENT-LEVEL FEEDBACK REQUIRED:
Do not just score the pattern. Always name specific moments and their impact.
- For positive pausing: "You paused before your main recommendation — that single moment of silence told your listener that something important was coming. It creates anticipation and signals confidence."
- For absent or weak pausing: "After your opening statement, there was an opportunity to let that land before moving on. A one to two second pause there would have given your listener a moment to absorb what you said before you continued."
- Be specific about when a pause occurred or would have landed. Reference the transcript content at that moment if possible.
- Never give only a pattern-level summary. Always name the moment and the impact.

COMMUNICATION FRAMEWORK DETECTION (structure dimension only):
This prompt's expected structural yardstick has been pre-classified as: ${input.structureFamily ?? "unclassified"}. This classification is authoritative — it is based on the prompt's actual intent, not a guess you need to make. Apply the matching rule set below. If unclassified, use the generic rules that follow.

GENERIC RULES (apply only when no more specific family rule below overrides them):
Analyse the transcript for evidence of structured communication frameworks: STAR (Situation, Task, Action, Result), SCR (Situation, Complication, Resolution), Pyramid Principle or point-first delivery (recommendation before rationale), PREP (Point, Reason, Example, Point), Problem-Solution-Benefit.
- Only flag a framework when it is clearly and intentionally present. Do not force-fit a label onto loose structure.
- If used well: name it and credit it specifically: "You led with your recommendation before giving context — that is point-first communication, and it immediately signals a senior, confident thinker."
- If used loosely or partially: comment on structure without naming the framework label: "You set up the situation well, but the response ended before reaching a clear resolution or recommendation. Your listener is left doing the work of drawing the conclusion themselves."
- If no structure is evident and the prompt is one where structure would be expected: "This response would have landed more powerfully with a clear opening statement of your main point, followed by your supporting reasoning."
- If the structure is genuinely ambiguous, say nothing about frameworks.
- Incorporate this into the structure dimension feedback block. Do not create a separate section.

${(input.structureFamily === "story" || input.structureFamily === "resilience") ? `STORY / BEHAVIOURAL ANSWER STRUCTURE (structureFamily: ${input.structureFamily}):
This prompt asks for a retrospective account of something that happened. Structure is not a nice-to-have here — it is what separates a forgettable answer from one that lands. Treat the structure dimension feedback as the most important coaching block in this session. Go deeper and be more specific than you would for a looser prompt.

STEP 1 — IDENTIFY: Determine explicitly whether the answer used STAR (Situation → Task → Action → Result), SCR (Situation → Complication → Resolution), PREP (Point → Reason → Example → Point), or another recognisable structure. If the answer is genuinely unstructured, name that directly.

STEP 2 — WHEN A FRAMEWORK WAS USED:
- Name it clearly and quote the moment that confirmed it: "Your answer followed the STAR framework. You opened by describing the team dynamics [S], explained the expectation to resolve the conflict before the product launch [T]..."
- Credit specifically what was strong: which element was vivid, concrete, and landed well with the listener
- Name what fell short: which element was vague, rushed, missing, or out of sequence — and state what the listener lost as a result. Do not let a partial framework pass without noting the gap.
- End with one precise instruction: what to strengthen in the next recording

STEP 3 — WHEN NO FRAMEWORK WAS USED:
- Do not just note the absence. Recommend the specific framework that would have served this answer best and explain why — not as a formula, but as a tool to make the message clearer for the listener.
- Give one concrete next step: what element to lead with or add in the next recording

STEP 4 — PARTIAL OR BROKEN STRUCTURE:
- Name the exact moment the structure broke down and the listener experience it creates.
${input.structureFamily === "resilience" ? `- RESILIENCE EXCEPTION: This prompt asks about a recent setback the speaker may still be working through. "What I am doing about it now" or "here is my plan going forward" IS a valid, complete result — do NOT demand a fully resolved, happy-ending outcome. Only flag the structure as incomplete if the speaker names the setback and stops, with no stated action or plan at all.` : `- Do not accept an answer that ends before reaching a result as complete. The listener is left doing the work of drawing the conclusion themselves.`}

RULE: Never use a framework label as a generic compliment. If you say STAR, demonstrate it — show which specific lines earned which letters.` : ""}

${input.structureFamily === "narrative" ? `NARRATIVE / SELF-INTRODUCTION STRUCTURE (structureFamily: narrative):
This prompt asks for a self-introduction or a walkthrough of something ongoing (background, or a project currently in progress) — not a competency demonstration or a decision that needs resolving.

1. CORRECT FRAMEWORK: The expected structure is a narrative arc — Past → Present → Future, or Present → Past → Future. STAR, SCR, and PREP are NOT appropriate frameworks for this prompt. Do not recommend them.

2. CORRECT CLOSE: A strong close is a forward-looking bridge — a brief statement of what's next, what the speaker is pursuing, or why it matters going forward. Examples: "…which is why I'm now looking for a role where I can [X]" or "…and that's what brought me to this conversation" or a stated ambition/goal for the work described. The close does NOT need to report a completed outcome, a proof point, or evidence that the effort "has worked" — if the prompt describes something ongoing or in progress, demanding proof of a finished result contradicts the prompt itself.

3. STRICTLY PROHIBITED: Do NOT penalise or flag the absence of a resolved outcome, a "so what for me" proof point, or company-specific motivation ("why this company/role/now") — those belong to different questions and have no place in the structural evaluation of a narrative answer. Calling a missing proof point a gap here is a coaching error.

4. MISSING CLOSE: If the narrative ends without any forward-looking statement at all — the speaker simply stops mid-story with no landing — flag it as: "The response ended without a forward-looking close. A brief statement of what comes next would give the listener a clear landing point."` : ""}

${input.structureFamily === "vision" ? `FUTURE-FACING / VISION STRUCTURE (structureFamily: vision):
This prompt explicitly asks the speaker to describe a future state or ambition (e.g. "what does success look like in three years," "where do you want to be"). It is not asking for a story or a completed achievement.

1. CORRECT FRAMEWORK: Expect a clear picture of the future state, why it matters, and — optionally — a bridge to present-day action. A bold, unresolved ambition stated at the close (e.g. a specific goal, number, or milestone) IS the correct and expected ending for this prompt.

2. STRICTLY PROHIBITED: Do NOT flag the absence of a completed result, a proof point, or evidence that the vision "has worked" or "has been achieved" — the prompt asks about the future, so nothing can yet be proven. Framing an unresolved ambition as an unfinished SCR arc is a coaching error for this prompt type.

3. What IS a legitimate gap: vagueness about what the future state actually looks like, no clear "why it matters," or a vision with no connection at all to what the speaker is doing today.` : ""}

${input.structureFamily === "rationale" ? `DIRECT-ANSWER / RATIONALE STRUCTURE (structureFamily: rationale):
This prompt asks a direct question — an opinion, a self-assessment, a motivation, or a reflection — not a narrated story with a plot.

1. CORRECT FRAMEWORK: Expect PREP-style point-first reasoning — a clear position stated early, followed by the reasoning or example that supports it. STAR and SCR are NOT appropriate frameworks here; do not recommend them or flag their absence.

2. STRICTLY PROHIBITED: Do NOT flag the absence of a "situation," a narrated sequence of events, or a resolved "result" — this prompt was never asking for a story.

3. What IS a legitimate gap: leading with reasoning before ever stating the actual point or position, or ending without ever landing on a clear answer to the question asked.` : ""}

${input.interviewMode ? `CLOSING QUESTION RULE (interview mode, structure dimension only):
If the speaker ends their answer with a genuine, substantive question directed back at the interviewer — an actual invitation for dialogue, not a rhetorical device — credit it as a structural strength. It is rare and signals intellectual confidence and curiosity. Examples of what qualifies: "What does success look like for this role in the first 90 days?" or "How does this team typically approach [topic the speaker just mentioned]?" Examples of what does NOT qualify: trailing check-ins ("…does that make sense?", "…right?") or rhetorical questions the speaker immediately answers themselves.

When it qualifies: name it in strengthText as a structural choice, not just a nice moment — explain why it works ("it signals that you are engaged with their world, not just selling yourself").

CRITICAL: Do NOT penalise or flag the absence of a closing question. This rule only fires when the behaviour is present. Never suggest the speaker should have asked a question if they did not.` : ""}

INTONATION — EMOTIONAL CONGRUENCE RULE:
For the intonation dimension only, cross-reference SOURCE C (transcript) against SOURCE A (audio delivery analysis) to check whether the pitch and vocal energy carry the emotional weight of the words.

Trigger condition: the speaker uses explicitly emotional or enthusiastic language — phrases such as "I am so excited", "I love", "I'm passionate about", "I can't wait", "this is amazing", "I really care about", "I'm thrilled", "I'm really excited", or any explicit statement of excitement, enthusiasm, or strong personal feeling.

When triggered, check whether SOURCE A describes matching energy: elevated pitch, rising inflection, increased engagement, warmth in the delivery at that moment.

When the words claim an emotion that the delivery does not carry — e.g. saying "I am so excited" in a flat, even, or measured tone — this IS an intonation gap and MUST be named explicitly in the intonation gapText:
- Quote the specific phrase from the transcript that claimed the emotion
- Describe what the delivery actually sounded like (flat, even-toned, controlled, measured)
- Name the listener impact: the listener hears the words but does not feel the energy — this creates a subtle disconnect, and the claim of excitement registers as a formality rather than a genuine signal
- End with one specific next step framed as an in-recording experiment: "In your next recording, let your voice lift on that phrase — not louder, but warmer and slightly higher — so the energy in your voice matches the feeling in the words."

When the delivery DOES match the emotional content, there is nothing to flag here. Do not manufacture a gap.

CRITICAL SCOPING RULE — NO DUPLICATION: This congruence check belongs EXCLUSIVELY to intonation. Do NOT reference it in vocal_tone. Vocal Tone covers the physical quality of the voice (warmth, resonance, richness, texture) — it does NOT assess whether vocal energy matches stated emotions. If the voice is physically warm but the energy does not match enthusiastic words, that is an intonation congruence gap, not a vocal tone gap. Each dimension must remain MECE.

CONCISENESS — REDUNDANCY AND REPETITION RULE:
When evaluating Conciseness, check for two distinct failure modes beyond simple wordiness:

1. RESTATEMENT: The speaker says the same idea more than once in different words without adding new meaning. This is different from emphasis — emphasis restates to land a point; restatement just fills time. If the same idea appears twice or more, flag which idea and what was lost (the listener registers it as padding, and authority erodes).

2. CIRCULAR REASONING: The speaker returns to an earlier point without building on it — e.g., ends where they began, references their opening claim again without developing it further, or loops through the same examples in a different order. Name the specific moment the response circled back and state the listener impact: it signals the speaker ran out of ideas rather than chose to stop.

Both are distinct from a long response that covers new ground throughout (which may score well on Conciseness despite high word count). Score them as meaningful gaps. A response that is brief but covers fresh ground on each sentence scores higher than one that takes twice as long restating the same two points.

CALIBRATION RULES:
- Score 9 or 10 must include specific named evidence for what earned it
- A 7 is solid professional standard — do not inflate to 8 or 9 to encourage
- Fewer than 50 words of transcript almost always scores 1–3 on content dimensions
- Never award 6+ to shallow responses that don't address the prompt
- Strengths must be genuine — do not reframe inadequate behaviour as positive
- If there are no genuine strengths, write: "This session did not demonstrate significant strengths in the areas assessed."

CONFIDENCE LANGUAGE — CRITICAL SCORING RULE:
Confidence Language is not a binary of "hedging vs. assertive". There are THREE distinct categories and they must be distinguished:
- HEDGING language (negative): "I think", "maybe", "kind of", "sort of", "I'm not sure but", "hopefully". These signal uncertainty and erode authority. Score them negatively.
- CONFIDENT language (positive): "The key issue is", "I recommend", "We will", "The evidence shows", clear declarative ownership of a position. Score these positively.
- AGGRESSIVE or DISMISSIVE language (negative — and distinct from confidence): emotionally charged, inflammatory, or demeaning language — "absolutely ridiculous", "complete disaster", "they have no idea", "this is insane", "dumb [slur]". CRITICAL: Do NOT treat this as a strength. Do NOT reframe it as "directness" or "committing to a position". This is aggression dressed as confidence, and it actively undermines executive credibility. It signals loss of emotional regulation, not conviction. Name the specific phrases, explain why they are a liability in professional settings, and penalise the score accordingly.
The presence of assertive language that is also aggressive does NOT compensate for hedging and should NOT be cited as evidence of confident communication.

FILLER WORD RULE (confidence_language dimension):
Filler words are a fourth signal within Confidence Language. They are provided as a separate metric from SOURCE A (gpt-audio), which hears the raw audio more reliably than the transcript.

If fillerWordCount > 0:
- Name the specific filler words heard and how many times each appeared (use the fillerWordObservation directly)
- State the listener impact specifically: at low counts (1–3 total), note they were present but did not dominate; at moderate counts (4–8), note they interrupt the authority of the delivery; at high counts (9+), note they become the dominant experience for the listener and significantly undermine credibility
- Distinguish between "um/uh" (involuntary gap fillers — signal thinking time, erode authority) and "like/you know/basically" (habitual language — signal casualness, erode executive register)
- End with one specific next-recording instruction: e.g. "In your next recording, when you feel the urge to fill silence, try replacing it with a pause — a half-second of silence reads as composure, not uncertainty."

If fillerWordCount is 0 or no data: do not mention filler words at all — do not credit their absence as a strength.

CRITICAL SCOPING RULE: Filler words belong EXCLUSIVELY to confidence_language. Do NOT reference them in articulation, vocal_tone, or any other dimension.

TRANSCRIPT RELIABILITY AND AUDIO FLAGS:
The transcript is generated automatically and may contain errors — particularly it can mishear or sanitise profanity or unclear words. The gpt-audio analysis (SOURCE A) hears the raw audio and is more reliable for what was actually said.
TRANSCRIPT LOOPING — CRITICAL: Automatic transcription occasionally loops, producing an exact or near-exact repeated phrase (e.g. "the development team for the development team for the development team") that the speaker never actually said — a transcription artifact, not a disfluency. Before citing ANY repeated word or phrase as evidence of a stumble, self-correction, or loss of thread, check SOURCE A (the audio delivery analysis): only report it as real if SOURCE A independently corroborates a stumble or restart at that point. If SOURCE A says nothing about it, do not mention the repetition at all — never quote or coach on a transcript pattern that the audio evidence does not support.
- If SOURCE A flags any words or phrases as unclear or potentially misheared (in clarityFlags), reference this in the articulation dimension feedback.
- If SOURCE A flags any professionally inappropriate language (in professionalLanguageFlags), you MUST address it in the confidence_language dimension feedback. Do not sanitise or soften the observation. Be direct and coaching-oriented: name what was said, note that it would undermine professional credibility in any real-world setting, and give a specific next step. The transcript may show a "clean" version of these words — disregard the transcript version and use what the audio model actually heard.`;

  // Detect recitation context
  const recitationKeywords = /\b(read|reading|recit|poem|poetry|poet|verse|stanza|lyric|speech by|passage|excerpt|monologue|prayer|scripture|psalm|soliloquy|ode|sonnet|perform|performed|performing|famous|literary|published|wrote|written by|marianne|williamson|shakespeare|rumi|frost|angelou|dickinson|neruda|whitman|keats|yeats|eliot|cummings)\b/i;
  const isRecitation = !!(input.promptText && recitationKeywords.test(input.promptText));

  const userPrompt = `Evaluate this speaker on executive presence dimensions using Methodology v4.0.

PROMPT THEY WERE RESPONDING TO:
"${input.promptText || "Open-ended speaking exercise"}"

CONTEXT CLASSIFICATION (determines pace standard):
${context.label}
Ideal pace for this context: ${context.idealWpmMin}–${context.idealWpmMax} words per minute
${isRecitation ? `\n⚠️ RECITATION CONTEXT DETECTED: The speaker's prompt indicates they were reading or reciting a pre-written literary or published text. Do NOT penalise structure for lacking original architecture — evaluate only how delivery served the text's structure. Do NOT penalise confidence_language for the text's word choices — evaluate only vocal conviction and commitment. Do NOT penalise conciseness for the text's natural length.` : ""}

SOURCE A — gpt-audio DELIVERY ANALYSIS (use for: articulation, projection, vocal_tone, vocal_steadiness, intonation, breath_control, and confidence_language filler word signal):
${input.audioDeliveryAnalysis || "[No audio delivery analysis available — scoring quality will be limited for audio dimensions]"}${input.fillerWordCount != null ? `

🗣️ FILLER WORD DATA (from audio — more reliable than transcript for this signal):
Total filler words heard: ${input.fillerWordCount}${input.fillerWordObservation ? `
Breakdown: ${input.fillerWordObservation}` : ""}
Use this in confidence_language feedback per the FILLER WORD RULE.` : ""}${input.clarityFlags ? `

⚠️ CLARITY FLAGS (words/phrases that sounded unclear or may have been misheared by transcription):
${input.clarityFlags}` : ""}${input.professionalLanguageFlags ? `

🚨 PROFESSIONAL LANGUAGE FLAGS (inappropriate language heard in the audio — the transcript may show a sanitised version; use THESE exact words in your feedback):
${input.professionalLanguageFlags}` : ""}

${input.mode === "video" ? `SOURCE D — CLAUDE VISION VIDEO ANALYSIS (use for: eye_contact, facial_expression, gestures, posture):
${input.videoPresenceAnalysis
  ? `Frames analyzed: ${input.videoPresenceAnalysis.framesAnalyzed}
Eye contact: ${input.videoPresenceAnalysis.eyeContactObservable
    ? input.videoPresenceAnalysis.eyeContactObservation
    : `[NOT OBSERVABLE — the speaker's eyes were not visible in this recording, so gaze could not be assessed. The eye_contact dimension has been removed from the dimension list below and is excluded from the composite score. Do NOT score it, do NOT write feedback for it, and do NOT infer gaze from head or face orientation. Do not reference eye contact, gaze, or camera connection anywhere in your summary, priority action, or any other dimension's feedback.]`}
Facial expression: ${input.videoPresenceAnalysis.lowerFaceVisible
    ? input.videoPresenceAnalysis.presenceObservation
    : `[LOWER FACE NOT VISIBLE — the mouth/jaw was not visible in any analyzed image. This is a real gap, not a missing signal: score facial_expression at 1 and write gapText/nextStepText explaining that the camera framing excluded the mouth/lower face, so expression couldn't be read, and that framing themselves so the full face is visible is the fix.]`}
Gestures: ${input.videoPresenceAnalysis.handsEverVisible
    ? input.videoPresenceAnalysis.gestureObservation
    : `[NO HANDS EVER VISIBLE — hands/arms did not appear gesturing in any analyzed image. This is a real gap, not a missing signal: score gestures at 1 and write gapText/nextStepText explaining that no visible gesturing means the speaker isn't using hand movement to reinforce their points on camera, and that framing themselves so hands are visible is the fix.]`}
Posture: ${input.videoPresenceAnalysis.shouldersVisible
    ? input.videoPresenceAnalysis.professionalAppearanceObservation
    : `[SHOULDERS NOT VISIBLE — the upper body was not in frame for this recording. This is a real gap, not a missing signal: score posture at 1 and write gapText/nextStepText explaining that the camera framing excluded the shoulders/upper body, so posture couldn't register, and that this is on the speaker to fix by framing the shot from the chest/shoulders up.]`}
Overall visual presence: ${input.videoPresenceAnalysis.overallVisualPresence}`
  : "[No video frame analysis available — visual dimensions (eye_contact, facial_expression, gestures, posture) cannot be assessed. Mark each as unavailable.]"}

GESTURE VOLUME SCORING RULE (gestures dimension only): The gesture observation above may describe two separate signals — gesture quality (well-formed vs fidgety/erratic) and gesture volume (how much of the recording was spent gesturing). These do NOT average together, and quality does NOT offset volume. If the observation describes gesture volume as constant, relentless, near-continuous, or consistently high with little to no stillness, that alone caps this dimension at 5 (Developing) regardless of how purposeful or well-formed the individual gestures were — relentless motion reads as anxious, ungrounded energy to a viewer even when each gesture is individually clean, and that experience is what this dimension measures. Do not let language praising gesture quality in the same observation pull the score back into Strong or Distinguished territory; a "yes, but constant" pattern is a low score with the quality noted as a secondary, smaller strength. Reserve Strong/Distinguished for sessions where gesturing is purposeful AND interspersed with genuine stillness — motion that has room to land because it is not continuous.

FACIAL ANIMATION SCORING RULE (facial_expression dimension only): The facial expression observation above may describe two separate signals — expression quality (warm/congruent vs flat/tense/incongruent) and animation intensity (measured vs exaggerated/theatrical). These do NOT average together, and warmth does NOT offset excess intensity. If the observation describes the expression as exaggerated, theatrical, or overly animated across the majority of the recording, that alone caps this dimension at 5 (Developing) regardless of how warm or congruent the expression otherwise was — performative, disproportionate expression reads as unnatural to a viewer even when it is warm and matches the content in direction. Do not let language praising warmth or congruence in the same observation pull the score back into Strong or Distinguished territory. Reserve Strong/Distinguished for sessions where expression is warm, congruent, AND proportionate to the content — animated where the moment calls for it, settled elsewhere.` : ""}

SOURCE C — TRANSCRIPT (use only for: confidence_language, structure, conciseness — do NOT use for audio or video dimensions):
${input.transcript ? `"${input.transcript}"` : "[No transcript captured]"}

SOURCE B — AUDIO WAVEFORM NUMERICS:
- Total recording duration: ${input.durationSeconds}s
- Active speech duration: ${input.speechDurationSeconds != null ? `${Math.round(input.speechDurationSeconds)}s (first word to last word)` : `unknown (use total duration as approximation)`}
- Speaking pace: ${wordsPerMinute} wpm (context ideal: ${context.idealWpmMin}–${context.idealWpmMax} wpm)
- Silence/pause events ≥4s: ${input.silenceEvents}
- Mode: ${input.mode}
- Recording context: ${input.recordingContext || "seated"}${input.rmsMetrics != null ? `
- Volume (RMS): mean ${input.rmsMetrics.meanRmsDb} dBFS, std ${input.rmsMetrics.rmsStdDb} dBFS` : ""}${input.f0Metrics != null && input.f0Metrics.voicedFrameCount > 0 ? `
- Pitch (F0): min ${input.f0Metrics.f0MinHz} Hz, max ${input.f0Metrics.f0MaxHz} Hz, std ${input.f0Metrics.f0StdHz} Hz, range ${input.f0Metrics.f0MaxHz - input.f0Metrics.f0MinHz} Hz (voiced frames: ${input.f0Metrics.voicedFrameCount})` : ""}${input.pauseMetrics != null ? `
- Pause analysis: ${input.pauseMetrics.pauseCount} pause(s) ≥0.5s detected, avg duration ${input.pauseMetrics.avgPauseDurationSeconds}s${input.pauseMetrics.pauses.length > 0 ? `, ${input.pauseMetrics.pauses.filter(p => p.isSentenceBoundary).length} at sentence/clause boundaries, ${input.pauseMetrics.pauses.filter(p => !p.isSentenceBoundary).length} mid-sentence` : ""}` : ""}${input.wpmWindows && input.wpmWindows.length > 0 ? `
- Pace over time (5-second windows — session average: ${wordsPerMinute} wpm): ${input.wpmWindows.map(w => `[${w.windowStartSeconds}s–${w.windowEndSeconds}s: ${w.wpm} wpm]`).join(", ")}` : ""}${input.pitchVariationScore != null ? `
- Pitch variation score (1-5 from audio engine): ${input.pitchVariationScore}` : ""}

WORD COUNT: ${wordCount} words
${wordCount < 30 ? `⚠️ VERY SHORT (${wordCount} words — under ~30s of speech). structure, conciseness, and confidence_language must score 1–3.` : wordCount < 80 ? `⚠️ BRIEF (${wordCount} words). Content dimension scores should reflect the limited material.` : ""}

DIMENSIONS TO EVALUATE:
${dimensionList}

PACE CONTEXT NOTE:
This prompt was classified as "${context.label}".
Ideal pace: ${context.idealWpmMin}–${context.idealWpmMax} words per minute.
Speaker's pace: ${wordsPerMinute} wpm (${wordsPerMinute < context.idealWpmMin ? `${context.idealWpmMin - wordsPerMinute} wpm BELOW ideal` : wordsPerMinute > context.idealWpmMax ? `${wordsPerMinute - context.idealWpmMax} wpm ABOVE ideal` : "within ideal range"}).
State this classification and ideal range explicitly in the pace dimension feedback.

SESSION HISTORY CONTEXT (used only for motivationalMessage — do not reference score numbers in the message):
Session number: ${input.sessionNumber ?? 1}
${input.previousCompositeScore != null
  ? `Previous session composite score: ${input.previousCompositeScore.toFixed(1)}. Based on your dimension scores in this evaluation, infer whether this session represents improvement, similar performance, or decline — but never state the numbers in the message.`
  : "This is the user's first session — no previous score exists."}

WEIGHT-AWARE SELECTION RULE — apply before choosing which dimensions go into summaryImprovements (and, secondarily, summaryStrengths):
Dimension weights in the composite score (highest to lowest): structure 0.15, confidence_language 0.13, intonation 0.08, vocal_tone 0.08, eye_contact 0.08, pace 0.07, conciseness 0.07, posture 0.05, projection 0.05 audio/0.06 video, pausing 0.06 audio/0.07 video, breath_control 0.04, articulation 0.04, facial_expression 0.04, vocal_steadiness 0.02 audio/0.04 video, gestures 0.03.
Do NOT choose summaryImprovements by lowest raw score alone. Choose the dimensions whose improvement would produce the biggest step-change in composite score and executive presence overall — that means weighing the score gap (how far below its ceiling the dimension sits) together with its composite weight. A dimension scoring 5 with weight 0.15 (e.g. structure) is a HIGHER priority than a dimension scoring 3 with weight 0.03 (e.g. gestures), because the higher-weight dimension moves the composite and the speaker's overall presence far more per point of improvement. Only surface a low-weight dimension ahead of a higher-weight one if the low-weight dimension is severely broken (score ≤2) or every higher-weight dimension is already Strong/Distinguished. Apply the same weight-aware logic to summaryStrengths when there is a genuine choice among several candidate strengths — prefer naming strength in a high-weight dimension, since that is more diagnostic of what's actually carrying the speaker's presence right now.

CROSS-CHECK RULE — apply before writing summaryStrengths and summaryImprovements:
A specific moment, named phrase, or word cited as evidence in summaryStrengths must NOT appear in summaryImprovements — and vice versa. Evidence belongs to one side only. If the same moment (e.g. a pause after a word, a sentence ending) could be framed as either a strength or a weakness, choose the reading that is most honest given the scores and commit to it on one side only. Citing the same evidence on both sides is a contradiction that destroys user trust.

Return a JSON object (no markdown, no code fences):
{
  "summaryStrengths": [
    "<one sentence. Names the specific dimension or what happened. Evidence-based — cite specific moments, phrases, or named words. Up to 3 items, ordered highest-priority first per the WEIGHT-AWARE SELECTION RULE. Empty array if no genuine positives.>"
  ],
  "summaryImprovements": [
    "<one sentence. Names the specific dimension. For Strong/Distinguished sessions: frame as relative gap, not absolute failure. Up to 3 items, chosen and ordered per the WEIGHT-AWARE SELECTION RULE — the dimensions that would produce the biggest step-change in composite score and executive presence come first, NOT simply the lowest-scoring dimensions. Must not reference any moment or phrase already cited in summaryStrengths.>"
  ],
  "priorityAction": "<for Developing/Strong/Distinguished sessions: identify the 1–2 highest-impact things to focus on in the next recording. Use TWO focus areas ONLY when ALL three conditions are met: (a) two separate dimensions are both clearly failing (score ≤5), (b) fixing one will NOT meaningfully fix the other — they are genuinely independent skills, AND (c) both dimensions carry significant composite weight (dimension weights from highest to lowest: structure 0.15, confidence_language 0.13, intonation 0.08, vocal_tone 0.08, eye_contact 0.08, pace 0.07, conciseness 0.07, posture 0.05, projection 0.05 audio/0.06 video, pausing 0.06 audio/0.07 video, breath_control 0.04, articulation 0.04, facial_expression 0.04, vocal_steadiness 0.02 audio/0.04 video, gestures 0.03). If conditions are not all met, give ONE focus area only — the highest-weight failing dimension. When giving two areas, address each in one sentence, together forming a single cohesive paragraph. NEVER suggest writing, scripting, or preparing material. Use language like 'in your next recording, try' or 'record again and notice whether'. For Needs Focus sessions: null.>",
  "priorityActions": ["<Start here: [specific mental focus or in-recording experiment — no writing, no scripting]>", "<Then here: [specific focus]>", "<Then here: [specific focus]>"],
  "recordAgainPrompt": "<one sentence. Frame the next recording as the natural continuation of this session — not optional, not homework. The insight from this session is most valuable when tested immediately. Make the user feel that recording again right now is the single most useful thing they can do. Be energetic and specific to what was observed in this session.>",
  "motivationalMessage": "<1–2 sentences max. About the act of showing up and the work ahead — NEVER about the score number. CRITICAL TONE CALIBRATION — read the dimension scores you just assigned and calibrate accordingly: If scores are mostly 7–10 (Distinguished/Strong range): you may acknowledge that the gap is now in refinement. If scores are mostly 4–6 (Developing range): the work is substantial and real — do NOT say things like 'the work is in the final five percent', 'you are almost there', 'just fine-tuning now', or anything that implies near-completion. A 5 or 6 means meaningful development is still ahead, not polish. If scores are mostly 1–3 (Needs Focus): be quietly affirming — acknowledge effort not outcome, never make the user feel they failed. Rules by session number: If sessionNumber=1: acknowledge starting is the hardest part; feel like a warm welcome and genuine recognition of a real first step. If sessionNumber=2: acknowledge that returning matters more than most people realise. If sessionNumber>=3: stop counting sessions; focus on the pattern — consistency, the habit of self-development. Score comparison (session 2+): if this session improved noticeably vs previous score: acknowledge progress implicitly, may name the dimension or pillar that moved — never state numbers. If improvement was small or score dropped: do not reference score movement; focus entirely on showing up and continuing. NEVER use: 'great job', 'well done', 'amazing effort', 'you're crushing it', 'the final five percent', 'almost there', or anything automated or hollow. Write as a real coach who heard this specific person and is being honest with them.>",
  "dimensions": {
    ${dimensions
      .map(
        d => `"${d}": {
      "score": <integer 1-10>,
      "strengthText": "<max 40 words, or null. If you score this dimension 4 or above: name a genuine strength, referencing something specific that happened in this session — named evidence, with measured values where available. If you score this dimension 3 or below: this field is shown to the user under the heading 'Starting point', NOT as praise. Write a neutral, factual description of where they currently are on this dimension — what the recording actually showed, stated plainly and without evaluation. If there is nothing factual and non-trivial to state, return null. NEVER manufacture a positive. Do not use consolation framing ('at least', 'at the very least', 'on the plus side', 'while X, you did manage Y') and do not present the absence of a further problem as an achievement. Returning null is always better than reaching for a compliment that is not there.>",
      "gapText": "<max 45 words — name the primary gap with specific evidence from this session, then state its impact on the listener. Warm and direct, not clinical.>",
      "nextStepText": "<max 45 words — one specific thing to try in their next recording here. Frame as mental preparation or an in-recording experiment. NEVER suggest writing, scripting, or noting anything down — all prep is mental. Use language like 'in your next recording, try' or 'record again and notice whether'. Do not recommend external tools.>"
    }`
      )
      .join(",\n    ")}
  }
}`;

  try {
    const t0 = Date.now();
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4500,
      messages: [{ role: "user", content: userPrompt }],
      system: systemPrompt,
    });

    logger.info({
      session_id: input.sessionId,
      ai_call: "claude-scoring",
      model: "claude-sonnet-4-6",
      elapsed_ms: Date.now() - t0,
      input_tokens: message.usage.input_tokens,
      output_tokens: message.usage.output_tokens,
    }, "claude-scoring usage");

    const block = message.content[0];
    const text = block.type === "text" ? block.text.trim() : "{}";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text) as AIEvalResult;
    return parsed;
  } catch (err) {
    return buildFallbackEvaluation(dimensions, wordCount, input.sessionNumber);
  }
}

function buildFallbackEvaluation(
  dimensions: DimensionKey[],
  wordCount: number,
  sessionNumber?: number
): AIEvalResult {
  const baseScore = wordCount < 30 ? 2 : wordCount < 80 ? 3 : 4;
  const sessionNum = sessionNumber ?? 1;
  const fallbackMotivational =
    sessionNum === 1
      ? "This is where it starts — and starting takes more courage than most people give themselves credit for."
      : sessionNum === 2
      ? "You came back. Most people talk about developing themselves — you're actually doing it."
      : "The consistency is the work. Every session you show up for compounds.";

  const result: AIEvalResult = {
    summaryStrengths: [],
    summaryImprovements: ["Full AI feedback could not be generated — please try recording again."],
    priorityAction: "In your next recording, aim for at least 90 seconds and respond directly to the prompt — that gives the system enough to work with.",
    priorityActions: [],
    recordAgainPrompt: "The best thing you can do right now is record again — a longer response will give you much richer feedback to work with.",
    motivationalMessage: fallbackMotivational,
    dimensions: {},
  };
  for (const d of dimensions) {
    result.dimensions[d] = {
      score: baseScore,
      strengthText: null,
      gapText: `Significant development needed in ${DIMENSION_LABELS[d]}.`,
      nextStepText: `In your next recording, try giving yourself more time on ${DIMENSION_LABELS[d]} — notice what changes when you slow down and focus on it.`,
    };
  }
  return result;
}

// ============================================================
// MAIN SCORING FUNCTION
// ============================================================

export async function scoreSession(input: ScoringInput): Promise<ScoringResult> {
  const allDimensions =
    input.mode === "audio" ? AUDIO_DIMENSIONS : VIDEO_DIMENSIONS;

  // Gaze cannot be read from head orientation, so when the vision pass reports
  // that the speaker's eyes were not visible we drop eye_contact entirely rather
  // than let the model produce a confident-sounding guess. It is left out of the
  // AI prompt (no wasted tokens), out of the composite, and out of the anchor
  // gating; the UI surfaces it as explicitly not scored.
  const eyeContactUnobservable =
    input.mode === "video" &&
    input.videoPresenceAnalysis != null &&
    input.videoPresenceAnalysis.eyeContactObservable === false;

  const dimensions = eyeContactUnobservable
    ? allDimensions.filter(d => d !== "eye_contact")
    : allDimensions;

  const unscoredDimensions: UnscoredDimension[] = eyeContactUnobservable
    ? [{
        dimensionKey: "eye_contact",
        label: DIMENSION_LABELS.eye_contact,
        reason:
          "Your eyes were not visible in this recording, so gaze could not be assessed. This dimension has not been scored and is not included in your composite score. To get eye contact feedback, record again with your eyes clearly visible to the camera.",
      }]
    : [];

  const context = classifyContext(input.promptText, input.promptContext);

  const audioQualityFlag = input.audioGapEvents > 5;
  const faceCoverageFlag = input.mode === "video" && input.faceLostEvents > 3;

  const aiResult = await runAIEvaluation(input, dimensions, context);

  // Unlike eye_contact (dropped from scoring when unobservable), total absence
  // of shoulders/hands is itself a real, scorable behaviour — poor framing or
  // a genuine lack of gesturing — so these are forced to the lowest score
  // rather than trusted to the second LLM call, which only sees the vision
  // pass's text and may not reliably apply a 1/10.
  const shouldersUnobservable =
    input.mode === "video" &&
    input.videoPresenceAnalysis != null &&
    input.videoPresenceAnalysis.shouldersVisible === false;
  const handsNeverVisible =
    input.mode === "video" &&
    input.videoPresenceAnalysis != null &&
    input.videoPresenceAnalysis.handsEverVisible === false;
  const lowerFaceUnobservable =
    input.mode === "video" &&
    input.videoPresenceAnalysis != null &&
    input.videoPresenceAnalysis.lowerFaceVisible === false;

  const dimensionResults: DimensionResult[] = dimensions.map(key => {
    let aiDim = aiResult.dimensions[key] ?? {
      score: 3,
      // No strength claimed on the fallback path — there is no evidence to
      // base one on, and inventing one is exactly what we are removing.
      strengthText: null,
      gapText: `${DIMENSION_LABELS[key]} needs significant development.`,
      nextStepText: `Focus on ${DIMENSION_LABELS[key]} in your next session.`,
    };

    if (key === "posture" && shouldersUnobservable) {
      aiDim = {
        score: 1,
        strengthText: null,
        gapText: "Your shoulders and upper body weren't visible in this recording, so posture couldn't be read as open or upright. That's a framing issue, and it counts against you — viewers form judgments about presence partly from visible body language, and none was available here.",
        nextStepText: "In your next recording, frame the camera so your shoulders and upper torso are in view — that's what lets your posture actually register.",
      };
    }
    if (key === "gestures" && handsNeverVisible) {
      aiDim = {
        score: 1,
        strengthText: null,
        gapText: "Your hands weren't visible at any point in this recording, so no gesturing could be observed. That reads as static — hand movement is part of how executive presence comes through on camera, and its total absence is a real gap, not a neutral limitation.",
        nextStepText: "In your next recording, frame yourself so your hands are visible, and notice whether you naturally gesture as you make your key points.",
      };
    }
    if (key === "facial_expression" && lowerFaceUnobservable) {
      aiDim = {
        score: 1,
        strengthText: null,
        gapText: "Your mouth and lower face weren't visible in this recording, so your expression couldn't be read. That's a framing issue, and it counts against you — warmth, tension, and engagement mostly show up in the mouth and jaw, and none of that was available here.",
        nextStepText: "In your next recording, frame the camera so your full face — forehead to chin — is in view, so your expression can actually register.",
      };
    }

    const score = Math.round(Math.min(10, Math.max(1, aiDim.score)));
    const tier = scoreToTier(score);

    const rawMetrics: Record<string, unknown> = {
      durationSeconds: input.durationSeconds,
      contextLabel: context.label,
      aiRawScore: aiDim.score,
    };

    // Attach acoustic metrics to the relevant dimensions
    if (key === "intonation" || key === "vocal_steadiness") {
      if (input.pitchVariationScore != null) rawMetrics.pitchVariationScore = input.pitchVariationScore;
      if (input.f0Metrics != null && input.f0Metrics.voicedFrameCount > 0) {
        rawMetrics.f0MinHz = input.f0Metrics.f0MinHz;
        rawMetrics.f0MaxHz = input.f0Metrics.f0MaxHz;
        rawMetrics.f0StdHz = input.f0Metrics.f0StdHz;
        rawMetrics.f0RangeHz = input.f0Metrics.f0MaxHz - input.f0Metrics.f0MinHz;
        rawMetrics.voicedFrameCount = input.f0Metrics.voicedFrameCount;
      }
    }
    if (key === "projection") {
      if (input.rmsMetrics != null) {
        rawMetrics.meanRmsDb = input.rmsMetrics.meanRmsDb;
        rawMetrics.rmsStdDb = input.rmsMetrics.rmsStdDb;
      }
    }
    if (key === "breath_control") {
      if (input.breathingScore != null) rawMetrics.breathingScore = input.breathingScore;
      if (input.breathingObservation) rawMetrics.breathingObservation = input.breathingObservation;
    }
    if (key === "pace") {
      const wordCount = input.transcript
        ? input.transcript.trim().split(/\s+/).filter(Boolean).length
        : 0;
      const paceDuration = input.speechDurationSeconds ?? input.durationSeconds;
      rawMetrics.wordsPerMinute = paceDuration > 0
        ? Math.round((wordCount / paceDuration) * 60)
        : 0;
      rawMetrics.idealWpmMin = context.idealWpmMin;
      rawMetrics.idealWpmMax = context.idealWpmMax;
      if (input.wpmWindows && input.wpmWindows.length > 0) {
        rawMetrics.wpmWindows = input.wpmWindows;
      }
    }
    if (key === "pausing" && input.pauseMetrics != null) {
      rawMetrics.pauseCount = input.pauseMetrics.pauseCount;
      rawMetrics.avgPauseDurationSeconds = input.pauseMetrics.avgPauseDurationSeconds;
      rawMetrics.boundaryPauses = input.pauseMetrics.pauses.filter(p => p.isSentenceBoundary).length;
      rawMetrics.midSentencePauses = input.pauseMetrics.pauses.filter(p => !p.isSentenceBoundary).length;
    }
    // Vision-based dimensions carry a weaker signal than acoustic/transcript
    // dimensions (periodic still frames vs. continuous audio/text), so tag
    // them with the sample size and derived confidence they were scored from.
    if (
      (key === "eye_contact" || key === "facial_expression" || key === "gestures" || key === "posture") &&
      input.videoPresenceAnalysis != null
    ) {
      rawMetrics.signalSource = "vision";
      rawMetrics.framesAnalyzed = input.videoPresenceAnalysis.framesAnalyzed;
      rawMetrics.confidence = input.videoPresenceAnalysis.visualConfidence;
    } else if (key !== "eye_contact" && key !== "facial_expression" && key !== "gestures" && key !== "posture") {
      rawMetrics.signalSource = key === "confidence_language" || key === "structure" || key === "conciseness"
        ? "transcript"
        : "acoustic";
    }

    // Inner work nudge — appended to nextStepText for trigger dimensions scoring ≤ 5
    const innerWorkNudges: Partial<Record<DimensionKey, string>> = {
      vocal_steadiness:
        "Steadiness at this level sometimes reflects something worth exploring beneath the technique — how we feel about the room, the stakes, or our right to be there. Worth sitting with: what changes in your voice when you speak as though your place in the room is already settled?",
      confidence_language:
        "The hedging patterns here can be habitual, but they can also reflect something deeper about how certain you feel in your own thinking. That is worth exploring beyond technique alone.",
      eye_contact:
        "When gaze feels difficult to direct consistently — whether toward the screen or toward the camera — it can sometimes reflect something beneath the technique: discomfort with being seen, uncertainty about the message, or how we relate to our own visibility. That layer is worth exploring further — worth noticing: what would shift if you let yourself be fully seen while you spoke?",
      posture:
        "How we hold ourselves physically can reflect inner states — tension, uncertainty, or how we feel about our right to take up space. That layer is worth exploring beyond physical adjustment alone.",
    };

    const nudge = score <= 5 ? (innerWorkNudges[key] ?? null) : null;
    const nextStepWithNudge = nudge
      ? `${aiDim.nextStepText || ""} ${nudge}`.trim()
      : aiDim.nextStepText || "";

    return {
      dimensionKey: key,
      score,
      tier,
      rawMetrics,
      strengthText: aiDim.strengthText?.trim() ? aiDim.strengthText.trim() : null,
      gapText: aiDim.gapText || "",
      nextStepText: nextStepWithNudge,
    };
  });

  const scoreMap = Object.fromEntries(
    dimensionResults.map(d => [d.dimensionKey, d.score])
  ) as Partial<Record<DimensionKey, number>>;

  const { composite, tier: compositeTier, gatingNote } = computeCompositeTier(scoreMap, input.mode);

  // Overall inner work escalation — triggers when 2+ of the 4 trigger dimensions score in Needs Focus (1–3)
  const innerWorkTriggerDimensions: DimensionKey[] = ["vocal_steadiness", "confidence_language", "eye_contact", "posture"];
  const innerWorkTriggerLabels: Partial<Record<DimensionKey, string>> = {
    vocal_steadiness: "Vocal Steadiness",
    confidence_language: "Confidence Language",
    eye_contact: "Eye Contact",
    posture: "Posture",
  };
  const needsFocusTriggers = innerWorkTriggerDimensions.filter(d => {
    const result = dimensionResults.find(r => r.dimensionKey === d);
    return result && result.score <= 3;
  });
  const innerWorkEscalation =
    needsFocusTriggers.length >= 2
      ? `A pattern worth noting: several of the signals in this session — ${needsFocusTriggers.map(d => innerWorkTriggerLabels[d]).join(", ")} — can point to something beneath the technique. The outer dimensions are the observable layer, but they are often shaped by inner foundations: how we hold ourselves in relation to the room, the stakes, and our own authority. If you find these patterns persisting across sessions, that inner layer is worth exploring further — it often shifts in ways that technique practice alone may not reach.`
      : null;

  const needsFocusComposite = compositeTier === "Needs Focus";
  const summaryStrengths = aiResult.summaryStrengths?.length
    ? aiResult.summaryStrengths
    : [];
  const summaryImprovements = aiResult.summaryImprovements?.length
    ? aiResult.summaryImprovements
    : (aiResult.overallImprovements ? [aiResult.overallImprovements] : []);
  const priorityActions = needsFocusComposite ? (aiResult.priorityActions || []) : [];
  const priorityAction = needsFocusComposite
    ? null
    : (aiResult.priorityAction || aiResult.overallNextStep || null);

  const overallFeedback = JSON.stringify({
    summaryStrengths,
    summaryImprovements,
    priorityAction,
    priorityActions,
    recordAgainPrompt: aiResult.recordAgainPrompt || null,
    motivationalMessage: aiResult.motivationalMessage || null,
    needsFocusPreamble:
      needsFocusComposite && priorityActions.length > 0
        ? "You have clear areas to move on — and the fastest way to move is to record again. Work through these one at a time, starting at the top."
        : null,
    noStrengthsLine:
      needsFocusComposite && summaryStrengths.length === 0
        ? "This session gives you a clear starting point. That clarity is exactly what you need to make the next recording count."
        : null,
    gatingNote,
    innerWorkEscalation,
    unscoredDimensions,
    // Legacy fields preserved for old-format fallback in frontend
    strengths: aiResult.overallStrengths || null,
    improvements: aiResult.overallImprovements || null,
    nextStep: aiResult.overallNextStep || null,
  });

  return {
    dimensions: dimensionResults,
    compositeScore: composite,
    compositeTier,
    gatingNote,
    audioQualityFlag,
    faceCoverageFlag,
    overallFeedback,
  };
}
