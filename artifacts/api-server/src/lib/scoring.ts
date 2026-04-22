import { anthropic } from "@workspace/integrations-anthropic-ai";
import { openai } from "@workspace/integrations-openai-ai-server";
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
  "articulation",
  "projection",
  "vocal_tone",
  "vocal_steadiness",
  "intonation",
  "pace",
  "pausing",
  "breath_control",
  "confidence_language",
  "structure",
  "conciseness",
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

const VIDEO_ANCHORS: DimensionKey[] = ["structure", "vocal_tone", "intonation", "eye_contact"];
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
  // Normalise in case not all dimensions are present
  let composite = totalWeight > 0 ? weightedSum / totalWeight : 0;
  // Re-scale to the actual weight sum (should be 1.0 when all dims present)
  composite = weightedSum;

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
// CONTEXT CLASSIFICATION — v4.0 Section 3
// ============================================================

export type ContextCategory = 1 | 2 | 3 | 4 | 5;

export interface ContextClassification {
  category: ContextCategory;
  label: string;
  idealWpmMin: number;
  idealWpmMax: number;
}

export function classifyContext(promptText: string | undefined): ContextClassification {
  if (!promptText) {
    return { category: 5, label: "Conversational / Interview", idealWpmMin: 130, idealWpmMax: 160 };
  }
  const p = promptText.toLowerCase();

  // Category 1: High Energy / Vision / Inspiration
  if (/\b(vision|motivat|inspir|rallying|bold|strategic direction|morale|enthus|exciting|ambitious)\b/.test(p) ||
      /\b(start of.*quarter|beginning of.*year|launch|kick.?off|energi)\b/.test(p)) {
    return { category: 1, label: "High Energy / Vision / Inspiration", idealWpmMin: 145, idealWpmMax: 175 };
  }

  // Category 2: Formal Presentation / Senior Stakeholder
  if (/\b(board|investor|c-suite|executive|ceo|cfo|coo|senior leader|stakeholder|quarterly review|investor pitch|earnings|formal presentation)\b/.test(p)) {
    return { category: 2, label: "Formal Presentation / Senior Stakeholder", idealWpmMin: 120, idealWpmMax: 145 };
  }

  // Category 3: Analytical / Technical / Complex
  if (/\b(data|technical|analysis|findings|recommend|analytical|complex|walkthrough|rationale|strategic analysis|research|metrics|numbers|results)\b/.test(p)) {
    return { category: 3, label: "Analytical / Technical", idealWpmMin: 115, idealWpmMax: 145 };
  }

  // Category 4: Difficult Conversation / Sensitive
  if (/\b(feedback|conflict|difficult|sensitive|underperform|missed.*deadline|apolog|address.*concern|personnel|performance review|disappointing|crisis|setback)\b/.test(p)) {
    return { category: 4, label: "Difficult Conversation / Sensitive", idealWpmMin: 110, idealWpmMax: 135 };
  }

  // Default: Category 5
  return { category: 5, label: "Conversational / Interview", idealWpmMin: 130, idealWpmMax: 160 };
}

// ============================================================
// INTERFACES
// ============================================================

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
  speechDurationSeconds?: number | null;
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
  rmsMetrics?: RmsMetrics | null;
  f0Metrics?: F0Metrics | null;
  pauseMetrics?: PauseMetrics | null;
  wpmWindows?: WpmWindow[] | null;
}

export type { RmsMetrics, F0Metrics, PauseMetrics, WpmWindow };

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
  gatingNote: string | null;
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

// ============================================================
// GPT-AUDIO DELIVERY ANALYSIS
// ============================================================

export async function analyzeAudioDelivery(
  audioBuffer: Buffer,
  format: CompatibleFormat,
  promptText?: string
): Promise<AudioDeliveryResult> {
  const audioBase64 = audioBuffer.toString("base64");

  const analysisPrompt = `${promptText ? `The speaker was responding to this prompt: "${promptText}". ` : ""}

You are a senior executive presence coach listening to this audio recording. Evaluate EVERYTHING you observe from the audio — both how the person speaks AND what they say. Base every observation solely on what you actually hear. Do not make generic statements; be specific about what you heard.

IMPORTANT: Ignore any silence at the very beginning or end of the recording. Your analysis should cover only the span from the first spoken word to the last spoken word.

Assess ALL of the following in detail:

VOICE QUALITY:
1. Articulation — How clearly and precisely words are formed. Are word endings dropped? Is there mumbling or slurring? How consistently do all words land clearly?
2. Projection — Does the voice carry consistently throughout each phrase? Does volume drop at sentence endings? Is there a pattern of trailing off or consistent amplitude?
3. Vocal Tone — The richness, warmth, and resonance of the voice as an instrument. Is the tone thin, nasal, strained, breathy, warm, resonant, or authoritative?
4. Vocal Steadiness — Is there audible tremor, pitch wavering, or tension-driven strain? Does the voice hold steady under pressure? Note F0 SD interpretation: if variation sounds expressive and purposeful = Intonation; if it sounds like anxiety or tremor = Vocal Steadiness.

VOCAL DELIVERY:
5. Intonation — Does pitch vary purposefully to signal emphasis, structure, and meaning? Or is delivery monotone? Note whether pitch falls decisively at statements (authority) or rises (uncertainty). Reference any pitch variation score 1-5.
6. Pace — Estimate speaking pace and any acceleration/deceleration patterns. Note rush events (bursts >200 WPM) and moments of deliberate slowing on key points.
7. Pausing — Observe strategic pauses at idea boundaries vs hesitation mid-thought. Are pauses used deliberately before key statements? Count boundary pauses vs mid-clause pauses.
8. Breath Control — Does breath support delivery through full phrases or does the voice thin at endings? Note audible inhalations, breath-induced mid-clause pauses, any pre-statement settling breaths.

THOUGHT CLARITY (from transcript/audio):
9. Confidence Language — Listen for hedging phrases ("I think", "maybe", "I guess", "kind of", "I believe", "hopefully", "I'm not sure but") versus assertive language ("I know", "We will", "The key point is", clear declarative statements). Quote specific phrases heard. Note filler word types and approximate count.
10. Structure — Clear opening that signals purpose? Organised logical body? Decisive close? Point-first delivery (recommendation before rationale)? Quote specific moments.
11. Conciseness — Does the speaker say what needs to be said and stop? Note any repetition of points, padding phrases ("as I said", "what I mean to say is", "basically"), or over-explanation.

Return your analysis as a JSON object with these exact keys:
{
  "articulation": "specific observation about word clarity, dropped endings, mumbling",
  "projection": "specific observation about volume consistency, phrase-ending drops, trailing",
  "vocalTone": "specific observation about richness, warmth, resonance, breathiness, nasality, strain",
  "vocalSteadiness": "specific observation about tremor, wavering, anxiety signals in voice",
  "pitchIntonation": "specific observation about pitch variation, monotone vs dynamic, pattern of rises/falls",
  "pitchVariationScore": <integer 1-5 where 1=completely monotone, 5=excellent expressive range>,
  "pace": "specific observation about speaking pace, rush moments, deceleration",
  "pausing": "specific observation about boundary pauses, mid-clause pauses, strategic silence use",
  "breathControl": "specific observation about phrase support, inhalations, breath-induced pauses",
  "breathingScore": <integer 1-5 where 1=severe breathlessness, 5=excellent relaxed control>,
  "confidenceLanguage": "specific hedging phrases heard (quote them) and specific assertive phrases heard (quote them), plus filler word count by type",
  "structure": "from listening: clear opening? organised body? decisive close? point-first delivery? Quote specific moments.",
  "conciseness": "specific observation about repetition, padding phrases, over-explanation",
  "overallDeliveryQuality": "direct summary of voice quality and delivery in 2-3 sentences"
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
        if (typeof parsed.breathControl === "string") breathingObservation = parsed.breathControl;
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

// ============================================================
// CLAUDE VISION — VIDEO FRAME ANALYSIS (updated for v4.0)
// ============================================================

export async function analyzeVideoPresence(
  frameBase64Array: string[],
  promptText?: string,
  recordingContext?: string
): Promise<VideoPresenceResult> {
  const frames = frameBase64Array.slice(0, 10);

  const analysisPrompt = `${promptText ? `The speaker was responding to this prompt: "${promptText}". ` : ""}${recordingContext ? `Recording context: ${recordingContext}.` : ""}

You are a senior executive presence coach reviewing a series of video frames captured at regular intervals during a ${recordingContext || "seated"} presentation. Analyze ONLY what you can directly observe in the images. Be specific and honest.

Assess the following four areas based solely on what you see in the frames:

1. EYE CONTACT: For each frame, classify the speaker's gaze as DIRECT (at/near camera lens), NEAR (slight deviation from camera), or OFF (clearly looking away — side, down, up). State the count for each classification. Then assess overall camera connection quality, consistency, and deliberateness.

2. FACIAL EXPRESSION: Is the expression flat, neutral, warm, animated, or incongruent with what appears to be serious content? Does the face convey genuine engagement? Is there visible tension (tight jaw, pressed lips, furrowed brow) or warmth? Does expression vary across frames to match content importance?

3. GESTURES: Are hand or arm gestures visible? Classify each as: purposeful (emphasise points, enumerate ideas), neutral (hands still or naturally positioned), or distracting (fidgeting, self-touching, erratic movement). Note posture — open vs closed body position.

4. POSTURE: Is the speaker upright, open, and settled? Or slumped, tense, or physically withdrawn? Is there evidence of deliberate forward lean on key moments? Is posture consistent across frames?

Return your analysis as a JSON object with these exact keys:
{
  "eyeContactObservation": "frame-by-frame classification (DIRECT/NEAR/OFF count), description of gaze direction and consistency, quality of camera connection",
  "gestureObservation": "specific description of gesture types observed, whether purposeful or distracting, body openness/closedness",
  "presenceObservation": "specific description of facial expression across frames — range, congruence, warmth, tension signals, engagement quality",
  "professionalAppearanceObservation": "specific assessment of posture (upright/settled vs slumped/tense), attire, grooming, and background",
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

// ============================================================
// TRANSCRIPTION
// ============================================================

export async function transcribeAudio(
  audioBuffer: Buffer
): Promise<{ transcript: string; speechDurationSeconds: number | null; pauseMetrics: PauseMetrics | null; wpmWindows: WpmWindow[] | null }> {
  const { buffer, format } = await ensureCompatibleFormat(audioBuffer);
  const result = await speechToTextWithTiming(buffer, format);
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

  const systemPrompt = `You are a senior executive presence coach and evaluator implementing the Gravitas Scoring Methodology v4.0. Your assessments are rigorous, evidence-based, and honest.

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

FEEDBACK STANDARDS — ALL FOUR MUST BE MET:
1. EVIDENCE-BASED: Reference specific measured values. Never generic statements.
   WRONG: "You spoke too fast."
   RIGHT: "Your pace averaged ${wordsPerMinute} words per minute. For this ${context.label} context, ideal is ${context.idealWpmMin}–${context.idealWpmMax} words per minute."
2. IMPACT-FRAMED: For 1–6, state what is happening to the audience as a result. For 7–10, state what would change if further developed.
3. COACHING TONE: End with one specific, doable next step. One action. No lists.
4. PLAIN LANGUAGE: No technical terms visible to the user.
   F0/fundamental frequency → "pitch / how your voice rises and falls"
   RMS amplitude → "volume / how your voice carries"
   dB → describe effect, omit unit
   Standard deviation / SD → "consistency / steadiness"
   gpt-audio / Claude Vision → NEVER mention in user-facing text

CALIBRATION RULES:
- Score 9 or 10 must include specific named evidence for what earned it
- A 7 is solid professional standard — do not inflate to 8 or 9 to encourage
- Fewer than 50 words of transcript almost always scores 1–3 on content dimensions
- Never award 6+ to shallow responses that don't address the prompt
- Strengths must be genuine — do not reframe inadequate behaviour as positive
- If there are no genuine strengths, write: "This session did not demonstrate significant strengths in the areas assessed."`;

  // Detect recitation context
  const recitationKeywords = /\b(read|reading|recit|poem|poetry|poet|verse|stanza|lyric|speech by|passage|excerpt|monologue|prayer|scripture|psalm|soliloquy|ode|sonnet|perform|performed|performing|famous|literary|published|wrote|written by|marianne|williamson|shakespeare|rumi|frost|angelou|dickinson|neruda|whitman|keats|yeats|eliot|cummings)\b/i;
  const isRecitation = !!(input.promptText && recitationKeywords.test(input.promptText));

  const userPrompt = `Evaluate this speaker on executive presence dimensions using Methodology v4.0.

PROMPT THEY WERE RESPONDING TO:
"${input.promptText || "Open-ended speaking exercise"}"

CONTEXT CLASSIFICATION (determines pace standard):
Category ${context.category} — ${context.label}
Ideal pace for this context: ${context.idealWpmMin}–${context.idealWpmMax} words per minute
${isRecitation ? `\n⚠️ RECITATION CONTEXT DETECTED: The speaker's prompt indicates they were reading or reciting a pre-written literary or published text. Do NOT penalise structure for lacking original architecture — evaluate only how delivery served the text's structure. Do NOT penalise confidence_language for the text's word choices — evaluate only vocal conviction and commitment. Do NOT penalise conciseness for the text's natural length.` : ""}

SOURCE A — gpt-audio DELIVERY ANALYSIS (use for: articulation, projection, vocal_tone, vocal_steadiness, intonation, breath_control):
${input.audioDeliveryAnalysis || "[No audio delivery analysis available — scoring quality will be limited for audio dimensions]"}

${input.mode === "video" ? `SOURCE D — CLAUDE VISION VIDEO ANALYSIS (use for: eye_contact, facial_expression, gestures, posture):
${input.videoPresenceAnalysis
  ? `Frames analyzed: ${input.videoPresenceAnalysis.framesAnalyzed}
Eye contact: ${input.videoPresenceAnalysis.eyeContactObservation}
Facial expression (from presenceObservation): ${input.videoPresenceAnalysis.presenceObservation}
Gestures and posture: ${input.videoPresenceAnalysis.gestureObservation}
Professional appearance / posture details: ${input.videoPresenceAnalysis.professionalAppearanceObservation}
Overall visual presence: ${input.videoPresenceAnalysis.overallVisualPresence}`
  : "[No video frame analysis available — visual dimensions (eye_contact, facial_expression, gestures, posture) cannot be assessed. Mark each as unavailable.]"}` : ""}

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
- Pace over time (30s windows): ${input.wpmWindows.map(w => `[${w.windowStartSeconds}s–${w.windowEndSeconds}s: ${w.wpm} wpm]`).join(", ")}` : ""}${input.pitchVariationScore != null ? `
- Pitch variation score (1-5 from audio engine): ${input.pitchVariationScore}` : ""}

WORD COUNT: ${wordCount} words
${wordCount < 30 ? `⚠️ VERY SHORT (${wordCount} words — under ~30s of speech). structure, conciseness, and confidence_language must score 1–3.` : wordCount < 80 ? `⚠️ BRIEF (${wordCount} words). Content dimension scores should reflect the limited material.` : ""}

DIMENSIONS TO EVALUATE:
${dimensionList}

PACE CONTEXT NOTE:
This prompt was classified as "${context.label}" (Category ${context.category}).
Ideal pace: ${context.idealWpmMin}–${context.idealWpmMax} words per minute.
Speaker's pace: ${wordsPerMinute} wpm (${wordsPerMinute < context.idealWpmMin ? `${context.idealWpmMin - wordsPerMinute} wpm BELOW ideal` : wordsPerMinute > context.idealWpmMax ? `${wordsPerMinute - context.idealWpmMax} wpm ABOVE ideal` : "within ideal range"}).
State this classification and ideal range explicitly in the pace dimension feedback.

Return a JSON object (no markdown, no code fences):
{
  "overallStrengths": "2–3 sentences on genuine strengths with specific evidence. If none, say so directly.",
  "overallImprovements": "2–3 sentences on most important improvements. Be specific and direct.",
  "overallNextStep": "The single most impactful action to practice before the next session (1 sentence, specific and actionable). Do not reference external apps or tools. Never suggest a target duration under 60 seconds.",
  "dimensions": {
    ${dimensions
      .map(
        d => `"${d}": {
      "score": <integer 1-10>,
      "strengthText": "<max 30 words — specific evidence, with measured values where available>",
      "gapText": "<max 30 words — primary gap with specific evidence and impact>",
      "nextStepText": "<max 35 words — one specific practice drill the speaker can do by recording another session here. Do not recommend external apps or tools. Never suggest a target recording duration under 60 seconds.>"
    }`
      )
      .join(",\n    ")}
  }
}`;

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 3000,
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

// ============================================================
// MAIN SCORING FUNCTION
// ============================================================

export async function scoreSession(input: ScoringInput): Promise<ScoringResult> {
  const dimensions =
    input.mode === "audio" ? AUDIO_DIMENSIONS : VIDEO_DIMENSIONS;

  const context = classifyContext(input.promptText);

  const audioQualityFlag = input.audioGapEvents > 5;
  const faceCoverageFlag = input.mode === "video" && input.faceLostEvents > 3;

  const aiResult = await runAIEvaluation(input, dimensions, context);

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
      contextCategory: context.category,
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
      rawMetrics.contextCategory = context.category;
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
  ) as Partial<Record<DimensionKey, number>>;

  const { composite, tier: compositeTier, gatingNote } = computeCompositeTier(scoreMap, input.mode);

  const overallFeedback = JSON.stringify({
    strengths: aiResult.overallStrengths,
    improvements: aiResult.overallImprovements,
    nextStep: aiResult.overallNextStep,
    gatingNote,
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
