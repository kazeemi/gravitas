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
  clarityFlags?: string | null;
  professionalLanguageFlags?: string | null;
  videoPresenceAnalysis?: VideoPresenceResult | null;
  recordingContext?: string;
  promptText?: string;
  promptContext?: string;
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
  promptText?: string
): Promise<AudioDeliveryResult> {
  const audioBase64 = audioBuffer.toString("base64");

  const analysisPrompt = `${promptText ? `The speaker was responding to this prompt: "${promptText}". ` : ""}

You are a senior executive presence coach listening to this audio recording. Focus exclusively on the RAW SONIC QUALITIES of the voice — what you hear in the audio itself. Be specific; no generic statements. Ignore silence at the start/end; analyse only from first word to last word. Keep each field to 1-2 sentences.

Assess the following:

1. Articulation — Clarity and precision of word formation. Are endings dropped, words mumbled or slurred?
2. Projection — Does the voice carry consistently? Does volume drop at phrase endings or trail off?
3. Vocal Tone — Richness, warmth, resonance of the voice. Thin, nasal, strained, breathy, warm, or authoritative?
4. Vocal Steadiness — Audible tremor, pitch wavering, or tension-driven strain? (Distinguish from expressive intonation.)
5. Intonation — Does pitch vary purposefully for emphasis and meaning, or is delivery monotone? Do statements fall with authority or rise with uncertainty?
6. Breath Control — Does breath support full phrases, or does the voice thin at endings? Note audible inhalations or breath-induced pauses.
7. clarityFlags — Any words/phrases mumbled, swallowed, or likely misheared by auto-transcription? Note timestamp and what you heard. Write "none" if all clear.
8. professionalLanguageFlags — Any profanity, crude language, or personally demeaning language? Quote exact words and timestamp. Write "none" if none.

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
  "clarityFlags": "observations or 'none'",
  "professionalLanguageFlags": "exact quotes or 'none'"
}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-audio-mini",
      modalities: ["text"],
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
    const rawText = (message?.content as string) || "";

    let pitchVariationScore: number | null = null;
    let breathingScore: number | null = null;
    let breathingObservation: string | null = null;
    let clarityFlags: string | null = null;
    let professionalLanguageFlags: string | null = null;

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
      }
    } catch {
      // parsing failure — scores remain null
    }

    return { analysisText: rawText, pitchVariationScore, breathingScore, breathingObservation, clarityFlags, professionalLanguageFlags };
  } catch (err) {
    console.error("gpt-audio delivery analysis failed:", err);
    return { analysisText: "", pitchVariationScore: null, breathingScore: null, breathingObservation: null, clarityFlags: null, professionalLanguageFlags: null };
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

1. EYE CONTACT: Internally classify the speaker's gaze in each image as DIRECT (looking at the camera lens OR at the screen — both count as engaged eye contact, since the screen is where a real conversation partner appears on a video call and looking at the screen is the natural, expected behaviour), NEAR (looking just off-screen or slightly to the side), or OFF (clearly looking away — far to the side, fully downward without purpose, or upward). IMPORTANT: looking at the screen is NOT a weakness — do not penalise it. Use these counts to form your observation, but do NOT mention "frames" or image numbers in your written output — describe patterns in plain terms (e.g. "throughout most of the recording", "at several points", "consistently"). Assess overall gaze engagement quality and consistency. In your coaching text, you may note that directing gaze specifically at the camera lens — rather than the screen — creates an even stronger sense of direct connection for the viewer, but only flag this as a refinement for speakers who are already scoring well, not as a primary gap.

2. FACIAL EXPRESSION: Is the expression flat, neutral, warm, animated, or incongruent with what appears to be serious content? Does the face convey genuine engagement? Is there visible tension (tight jaw, pressed lips, furrowed brow) or warmth? Does expression vary across the recording to match content importance?

3. GESTURES: Are hand or arm gestures visible? Classify each as: purposeful (emphasise points, enumerate ideas), neutral (hands still or naturally positioned), or distracting (fidgeting, self-touching, erratic movement). Note posture — open vs closed body position.

4. POSTURE: Is the speaker upright, open, and settled? Or slumped, tense, or physically withdrawn? Is there evidence of deliberate forward lean on key moments? Is posture consistent throughout the recording?

CRITICAL LANGUAGE RULE: Your written observations must NEVER use the words "frame", "frames", "image", or image numbers (e.g. "frame 6", "in image 3"). Describe everything in plain, user-friendly language as if you are a human coach who watched a video — use terms like "throughout your recording", "at several points during your session", "consistently", "for most of the session", "at times", etc.

Return your analysis as a JSON object with these exact keys:
{
  "eyeContactObservation": "gaze pattern classification (DIRECT/NEAR/OFF counts expressed as proportions or plain descriptions), description of gaze direction and consistency, quality of camera connection — NO frame numbers",
  "gestureObservation": "specific description of gesture types observed, whether purposeful or distracting, body openness/closedness — NO frame numbers",
  "presenceObservation": "specific description of facial expression throughout the recording — range, congruence, warmth, tension signals, engagement quality — NO frame numbers",
  "professionalAppearanceObservation": "specific assessment of posture (upright/settled vs slumped/tense), attire, grooming, and background — NO frame numbers",
  "overallVisualPresence": "2-sentence summary of the speaker's overall visual executive presence — NO frame numbers"
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
Analyse the transcript for evidence of structured communication frameworks: STAR (Situation, Task, Action, Result), SCR (Situation, Complication, Resolution), Pyramid Principle or point-first delivery (recommendation before rationale), PREP (Point, Reason, Example, Point), Problem-Solution-Benefit.
Rules:
- Only flag a framework when it is clearly and intentionally present. Do not force-fit a label onto loose structure.
- If used well: name it and credit it specifically: "You led with your recommendation before giving context — that is point-first communication, and it immediately signals a senior, confident thinker."
- If used loosely or partially: comment on structure without naming the framework label: "You set up the situation well, but the response ended before reaching a clear resolution or recommendation. Your listener is left doing the work of drawing the conclusion themselves."
- If no structure is evident and the prompt is one where structure would be expected (interview question, presentation prompt, stakeholder update): "This response would have landed more powerfully with a clear opening statement of your main point, followed by your supporting reasoning."
- If the structure is genuinely ambiguous, say nothing about frameworks.
- Incorporate this into the structure dimension feedback block. Do not create a separate section.

${input.interviewMode ? `INTERVIEW ANSWER STRUCTURE — ELEVATED PRIORITY (this user is preparing for a job interview):
For interview answers, structure is not a nice-to-have — it is what separates a forgettable answer from one that lands. Treat the structure dimension feedback as the most important coaching block in this session. Go deeper and be more specific than you would in a standard session.

STEP 1 — IDENTIFY: Determine explicitly whether the answer used STAR (Situation → Task → Action → Result), SCR (Situation → Complication → Resolution), PREP (Point → Reason → Example → Point), or another recognisable structure. If the answer is genuinely unstructured, name that directly.

STEP 2 — WHEN A FRAMEWORK WAS USED:
- Name it clearly and quote the moment that confirmed it: "Your answer followed the STAR framework. You opened by describing the team dynamics [S], explained the expectation to resolve the conflict before the product launch [T]..."
- Credit specifically what was strong: which element was vivid, concrete, and landed well with the listener
- Name what fell short: which element was vague, rushed, missing, or out of sequence — and state what the listener lost as a result. Do not let a partial framework pass without noting the gap.
- End with one precise instruction: what to strengthen in the next recording

STEP 3 — WHEN NO FRAMEWORK WAS USED:
- Do not just note the absence. Recommend the specific framework that would have served this answer best and explain why — not as a formula, but as a tool to make the message clearer for the listener.
- Example: "This answer would have landed more powerfully with a STAR structure. You shared what you did, but your interviewer had no context for the situation you were walking into or what specifically was at stake. That context is what makes the action feel consequential. Without it, the achievement sounds smaller than it probably was."
- Give one concrete next step: what element to lead with or add in the next recording

STEP 4 — PARTIAL OR BROKEN STRUCTURE:
- Name the exact moment the structure broke down: "You set up the situation clearly and described your approach well, but the response ended before reaching the result — your interviewer is left without a clear landing point."
- Name the listener experience: "That gap puts the burden of interpretation on the interviewer. In a high-stakes interview, you want to close the loop explicitly."

RULE: Never use a framework label as a generic compliment. If you say STAR, demonstrate it — show which specific lines earned which letters.` : ""}

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

TRANSCRIPT RELIABILITY AND AUDIO FLAGS:
The Whisper transcript is generated automatically and may contain errors — particularly it can mishear or sanitise profanity or unclear words. The gpt-audio analysis (SOURCE A) hears the raw audio and is more reliable for what was actually said.
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

SOURCE A — gpt-audio DELIVERY ANALYSIS (use for: articulation, projection, vocal_tone, vocal_steadiness, intonation, breath_control):
${input.audioDeliveryAnalysis || "[No audio delivery analysis available — scoring quality will be limited for audio dimensions]"}${input.clarityFlags ? `

⚠️ CLARITY FLAGS (words/phrases that sounded unclear or may have been misheared by transcription):
${input.clarityFlags}` : ""}${input.professionalLanguageFlags ? `

🚨 PROFESSIONAL LANGUAGE FLAGS (inappropriate language heard in the audio — the transcript may show a sanitised version; use THESE exact words in your feedback):
${input.professionalLanguageFlags}` : ""}

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

CROSS-CHECK RULE — apply before writing summaryStrengths and summaryImprovements:
A specific moment, named phrase, or word cited as evidence in summaryStrengths must NOT appear in summaryImprovements — and vice versa. Evidence belongs to one side only. If the same moment (e.g. a pause after a word, a sentence ending) could be framed as either a strength or a weakness, choose the reading that is most honest given the scores and commit to it on one side only. Citing the same evidence on both sides is a contradiction that destroys user trust.

Return a JSON object (no markdown, no code fences):
{
  "summaryStrengths": [
    "<one sentence. Names the specific dimension or what happened. Evidence-based — cite specific moments, phrases, or named words. Up to 3 items. Empty array if no genuine positives.>"
  ],
  "summaryImprovements": [
    "<one sentence. Names the specific dimension. For Strong/Distinguished sessions: frame as relative gap, not absolute failure. Up to 3 items. Must not reference any moment or phrase already cited in summaryStrengths.>"
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
      "strengthText": "<max 40 words — reference something specific that happened in this session. Named evidence. With measured values where available.>",
      "gapText": "<max 45 words — name the primary gap with specific evidence from this session, then state its impact on the listener. Warm and direct, not clinical.>",
      "nextStepText": "<max 45 words — one specific thing to try in their next recording here. Frame as mental preparation or an in-recording experiment. NEVER suggest writing, scripting, or noting anything down — all prep is mental. Use language like 'in your next recording, try' or 'record again and notice whether'. Do not recommend external tools.>"
    }`
      )
      .join(",\n    ")}
  }
}`;

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4500,
      messages: [{ role: "user", content: userPrompt }],
      system: systemPrompt,
    });

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
      strengthText: `Some foundational elements present in ${DIMENSION_LABELS[d]}.`,
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
  const dimensions =
    input.mode === "audio" ? AUDIO_DIMENSIONS : VIDEO_DIMENSIONS;

  const context = classifyContext(input.promptText, input.promptContext);

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

    // Inner work nudge — appended to nextStepText for trigger dimensions scoring ≤ 5
    const innerWorkNudges: Partial<Record<DimensionKey, string>> = {
      vocal_steadiness:
        "Steadiness at this level sometimes reflects something worth exploring beneath the technique — how we feel about the room, the stakes, or our right to be there. A conversation with a coach can help surface and shift that layer.",
      confidence_language:
        "The hedging patterns here can be habitual, but they can also reflect something deeper about how certain you feel in your own thinking. That is worth exploring beyond technique alone.",
      eye_contact:
        "When gaze feels difficult to direct consistently — whether toward the screen or toward the camera — it can sometimes reflect something beneath the technique: discomfort with being seen, uncertainty about the message, or how we relate to our own visibility. That layer is worth exploring with a coach.",
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
      strengthText: aiDim.strengthText || "",
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
      ? `A pattern worth noting: several of the signals in this session — ${needsFocusTriggers.map(d => innerWorkTriggerLabels[d]).join(", ")} — can point to something beneath the technique. The outer dimensions are the observable layer, but they are often shaped by inner foundations: how we hold ourselves in relation to the room, the stakes, and our own authority. If you find these patterns persisting across sessions, working with a coach on that inner layer can create change that technique practice alone may not reach.`
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
