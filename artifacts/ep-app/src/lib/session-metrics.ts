import type { SessionDetail } from "@/lib/api";

export type MetricStatus = "good" | "warn" | "poor";

export interface SessionMetric {
  label: string;
  value: string;
  benchmark: string;
  status: MetricStatus;
  note?: string;
}

const PITCH_LABELS: Record<number, string> = {
  1: "Completely flat / monotone",
  2: "Minimal variation",
  3: "Some variation — inconsistent",
  4: "Good natural variation",
  5: "Excellent dynamic range",
};

const BREATH_LABELS: Record<number, string> = {
  1: "Severe breathlessness",
  2: "Noticeably shallow or strained",
  3: "Adequate — some strain",
  4: "Mostly controlled and relaxed",
  5: "Excellent relaxed control",
};

function getRaw<T>(dim: SessionDetail["dimensionScores"] extends (infer D)[] | undefined ? D | undefined : never, key: string, type: string): T | null {
  const val = dim?.rawMetrics ? (dim.rawMetrics as Record<string, unknown>)[key] : undefined;
  return typeof val === type ? (val as T) : null;
}

function score5Status(v: number): MetricStatus {
  return v >= 4 ? "good" : v === 3 ? "warn" : "poor";
}

export function computeSessionMetrics(session: SessionDetail): SessionMetric[] {
  const duration = session.durationSeconds ?? 0;
  const transcript = session.transcript ?? "";
  const words = transcript.trim() ? transcript.trim().split(/\s+/).filter(Boolean) : [];
  const wordCount = words.length > 0 ? words.length : null;
  const wpm = wordCount !== null && duration > 0 ? Math.round((wordCount / duration) * 60) : null;
  const fillerCount = transcript
    ? (transcript.match(/\b(um+|uh+|like|you know|so,?|basically|literally|actually|right\?|i mean|kind of|sort of|you see)\b/gi) || []).length
    : null;
  const fillerRate =
    fillerCount !== null && duration > 0
      ? parseFloat((fillerCount / (duration / 60)).toFixed(1))
      : null;
  const silences = session.silenceEvents ?? 0;
  const lexicalVariance =
    wordCount !== null && wordCount > 0
      ? Math.round(
          (new Set(words.map(w => w.toLowerCase().replace(/[^a-z]/g, ""))).size / wordCount) * 100
        )
      : null;

  const paceDim = session.dimensionScores?.find(d => d.dimensionKey === "pace");
  const intonationDim = session.dimensionScores?.find(d => d.dimensionKey === "intonation");
  const breathDim = session.dimensionScores?.find(d => d.dimensionKey === "breath_control");
  const legacyPaceRhythm = session.dimensionScores?.find(d => d.dimensionKey === "pace_rhythm");
  const legacyVocalClarity = session.dimensionScores?.find(d => d.dimensionKey === "vocal_clarity");
  const pitchSource = intonationDim ?? legacyPaceRhythm;
  const breathSource = breathDim ?? legacyVocalClarity;

  const pitchVariationScore = getRaw<number>(pitchSource, "pitchVariationScore", "number");
  const breathingScore = getRaw<number>(breathSource, "breathingScore", "number");
  const contextLabel = getRaw<string>(paceDim, "contextLabel", "string");
  const idealWpmMin = getRaw<number>(paceDim, "idealWpmMin", "number");
  const idealWpmMax = getRaw<number>(paceDim, "idealWpmMax", "number");

  const wpmStatus = (v: number): MetricStatus => {
    if (idealWpmMin !== null && idealWpmMax !== null) {
      if (v >= idealWpmMin && v <= idealWpmMax) return "good";
      return Math.abs(v < idealWpmMin ? idealWpmMin - v : v - idealWpmMax) <= 20 ? "warn" : "poor";
    }
    if (v >= 120 && v <= 160) return "good";
    return (v >= 100 && v < 120) || (v > 160 && v <= 185) ? "warn" : "poor";
  };

  const metrics: SessionMetric[] = [];

  if (duration > 0) {
    metrics.push({
      label: "Duration",
      value: `${Math.floor(duration / 60)}m ${duration % 60}s`,
      benchmark: "≥ 1 minute",
      status: duration >= 60 ? "good" : "poor",
    });
  }
  if (wpm !== null) {
    metrics.push({
      label: "Speaking pace",
      value: `${wpm} WPM`,
      benchmark:
        idealWpmMin !== null && idealWpmMax !== null
          ? `${idealWpmMin}–${idealWpmMax} WPM${contextLabel ? ` (${contextLabel})` : ""}`
          : "120–160 WPM",
      status: wpmStatus(wpm),
      note:
        idealWpmMin !== null && idealWpmMax !== null
          ? wpm < idealWpmMin
            ? "Below ideal for this context"
            : wpm > idealWpmMax
            ? "Above ideal — consider slowing down on key points"
            : "Within the ideal range for this context"
          : undefined,
    });
  }
  if (pitchVariationScore !== null) {
    metrics.push({
      label: "Pitch variation",
      value: `${pitchVariationScore}/5 — ${PITCH_LABELS[pitchVariationScore] ?? ""}`,
      benchmark: "4–5 (natural expressive variation)",
      status: score5Status(pitchVariationScore),
    });
  }
  if (breathingScore !== null) {
    metrics.push({
      label: "Breath control",
      value: `${breathingScore}/5 — ${BREATH_LABELS[breathingScore] ?? ""}`,
      benchmark: "4–5 (controlled, relaxed)",
      status: score5Status(breathingScore),
    });
  }
  if (fillerRate !== null) {
    metrics.push({
      label: "Filler word rate",
      value: fillerCount === 0 ? "None detected" : `${fillerRate}/min (${fillerCount} total)`,
      benchmark: "< 1 per minute",
      status: fillerRate < 1 ? "good" : fillerRate < 3 ? "warn" : "poor",
    });
  }
  if (lexicalVariance !== null && wordCount !== null && wordCount >= 50) {
    metrics.push({
      label: "Vocabulary variety",
      value: `${lexicalVariance}% unique words`,
      benchmark: "> 70% (rich, non-repetitive language)",
      status: lexicalVariance > 70 ? "good" : lexicalVariance >= 55 ? "warn" : "poor",
    });
  }
  metrics.push({
    label: "Long pauses (4s+)",
    value: silences === 0 ? "None" : String(silences),
    benchmark: "0 unplanned pauses",
    status: silences === 0 ? "good" : silences <= 2 ? "warn" : "poor",
  });

  return metrics;
}
