import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { api, type SessionDetail, type DimensionScore } from "@/lib/api";
import { getTierColors, DIMENSION_LABELS, DIMENSION_DISPLAY_ORDER, DIMENSION_DESCRIPTIONS } from "@/lib/tier-colors";
import { Button } from "@/components/ui/button";
import {
  ChevronLeftIcon,
  MicIcon,
  VideoIcon,
  AlertTriangleIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  ZapIcon,
} from "lucide-react";
import { format } from "date-fns";

interface OverallFeedback {
  strengths?: string;
  improvements?: string;
  nextStep?: string;
}

function parseOverallFeedback(raw: string | null): OverallFeedback | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as OverallFeedback;
  } catch {
    return { strengths: raw };
  }
}

export default function SessionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showTranscript, setShowTranscript] = useState(false);
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!id) return;
    api.sessions
      .get(id)
      .then(setSession)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 rounded-full border-4 border-gray-200 border-t-gray-900 animate-spin" />
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="py-20 text-center">
        <p className="text-sm text-gray-500">{error || "Session not found"}</p>
        <Button className="mt-4" variant="outline" onClick={() => setLocation("/history")}>
          Back to history
        </Button>
      </div>
    );
  }

  const colors = session.compositeTier ? getTierColors(session.compositeTier) : null;
  const score = session.compositeScore ? parseFloat(session.compositeScore) : null;
  const overallFeedback = parseOverallFeedback(session.overallFeedback ?? null);

  const sortedDimensions = [...session.dimensionScores].sort((a, b) => {
    const ai = DIMENSION_DISPLAY_ORDER.indexOf(a.dimensionKey);
    const bi = DIMENSION_DISPLAY_ORDER.indexOf(b.dimensionKey);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });

  const hasSilences = (session.silenceEvents ?? 0) > 0;

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-10">
      <div className="flex items-center gap-3">
        <button
          onClick={() => setLocation("/history")}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900"
        >
          <ChevronLeftIcon className="h-4 w-4" />
          History
        </button>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              {session.mode === "audio" ? (
                <MicIcon className="h-4 w-4" />
              ) : (
                <VideoIcon className="h-4 w-4" />
              )}
              <span className="capitalize">{session.mode} session</span>
              <span>·</span>
              <span>{format(new Date(session.createdAt), "MMM d, yyyy")}</span>
              {session.durationSeconds && (
                <>
                  <span>·</span>
                  <span>
                    {Math.floor(session.durationSeconds / 60)}m {session.durationSeconds % 60}s
                  </span>
                </>
              )}
            </div>
            {session.promptText && (
              <p className="mt-2 font-medium text-gray-800">{session.promptText}</p>
            )}
          </div>
          {score !== null && colors && (
            <div className="text-right flex-shrink-0 ml-4">
              <p className="text-3xl font-bold" style={{ color: colors.hex }}>
                {score.toFixed(1)}
              </p>
              <span
                className="mt-1 inline-block rounded px-2 py-0.5 text-xs font-medium text-white"
                style={{ backgroundColor: colors.hex }}
              >
                {session.compositeTier}
              </span>
            </div>
          )}
        </div>

        {(session.audioQualityFlag || session.faceCoverageFlag) && (
          <div className="mt-4 flex items-start gap-2 rounded border border-amber-200 bg-amber-50 p-3">
            <AlertTriangleIcon className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-amber-700">
              {session.audioQualityFlag && "Audio quality issues detected — scores may be less accurate. "}
              {session.faceCoverageFlag && "Face was not consistently visible — video scores may be less accurate."}
            </p>
          </div>
        )}

        {hasSilences && (
          <div className="mt-3 flex items-start gap-2 rounded border border-amber-200 bg-amber-50 p-3">
            <AlertTriangleIcon className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-amber-700">
              {session.silenceEvents} long pause{session.silenceEvents !== 1 ? "s" : ""} detected during your recording (pauses over 4 seconds). This can disrupt your listeners' engagement and affect your pacing score.
            </p>
          </div>
        )}
      </div>

      {overallFeedback && (
        <div className="rounded-lg border border-gray-200 bg-white p-6 space-y-4">
          <h2 className="font-semibold text-gray-900 text-lg">Overall coaching summary</h2>
          {overallFeedback.strengths && (
            <div className="flex gap-3">
              <div className="flex-shrink-0 mt-0.5">
                <div className="h-6 w-6 rounded-full bg-green-100 flex items-center justify-center">
                  <TrendingUpIcon className="h-3.5 w-3.5 text-green-600" />
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-green-700 mb-1">
                  Strengths
                </p>
                <p className="text-sm text-gray-700 leading-relaxed">{overallFeedback.strengths}</p>
              </div>
            </div>
          )}
          {overallFeedback.improvements && (
            <div className="flex gap-3">
              <div className="flex-shrink-0 mt-0.5">
                <div className="h-6 w-6 rounded-full bg-amber-100 flex items-center justify-center">
                  <TrendingDownIcon className="h-3.5 w-3.5 text-amber-600" />
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 mb-1">
                  Areas to improve
                </p>
                <p className="text-sm text-gray-700 leading-relaxed">{overallFeedback.improvements}</p>
              </div>
            </div>
          )}
          {overallFeedback.nextStep && (
            <div className="flex gap-3">
              <div className="flex-shrink-0 mt-0.5">
                <div className="h-6 w-6 rounded-full bg-blue-100 flex items-center justify-center">
                  <ZapIcon className="h-3.5 w-3.5 text-blue-600" />
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-700 mb-1">
                  Priority next step
                </p>
                <p className="text-sm text-gray-700 leading-relaxed">{overallFeedback.nextStep}</p>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="space-y-4">
        <h2 className="font-semibold text-gray-900">Dimension feedback</h2>
        {sortedDimensions.map((d) => (
          <DimensionCard key={d.id} score={d} />
        ))}
      </div>

      <SessionMetrics session={session} />

      {session.transcript && (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <button
            onClick={() => setShowTranscript(!showTranscript)}
            className="flex items-center justify-between w-full text-left"
          >
            <h2 className="font-semibold text-gray-900">Session transcript</h2>
            <span className="text-xs text-gray-400">{showTranscript ? "Hide" : "Show"}</span>
          </button>
          {showTranscript && (
            <div className="mt-4 rounded border border-gray-100 bg-gray-50 p-4">
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                {session.transcript}
              </p>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-3">
        <Button variant="outline" onClick={() => setLocation("/record")}>
          New session
        </Button>
        <Button
          variant="outline"
          className="text-red-600 border-red-200 hover:bg-red-50"
          onClick={async () => {
            if (!confirm("Delete this session?")) return;
            await api.sessions.delete(session.id);
            setLocation("/history");
          }}
        >
          Delete
        </Button>
      </div>
    </div>
  );
}

function SessionMetrics({ session }: { session: SessionDetail }) {
  const duration = session.durationSeconds ?? 0;
  const transcript = session.transcript ?? "";

  const wordCount = transcript.trim()
    ? transcript.trim().split(/\s+/).filter(Boolean).length
    : null;

  const wpm =
    wordCount !== null && duration > 0
      ? Math.round((wordCount / duration) * 60)
      : null;

  const fillerCount = transcript
    ? (transcript.match(
        /\b(um+|uh+|like|you know|so,?|basically|literally|actually|right\?|i mean|kind of|sort of|you see)\b/gi
      ) || []).length
    : null;

  const durationMinutes = duration / 60;
  const fillerRate =
    fillerCount !== null && durationMinutes > 0
      ? parseFloat((fillerCount / durationMinutes).toFixed(1))
      : null;

  const silences = session.silenceEvents ?? 0;

  type Status = "good" | "warn" | "poor";

  function wpmStatus(v: number): Status {
    if (v >= 120 && v <= 160) return "good";
    if ((v >= 100 && v < 120) || (v > 160 && v <= 185)) return "warn";
    return "poor";
  }

  function fillerRateStatus(v: number): Status {
    if (v < 1) return "good";
    if (v < 3) return "warn";
    return "poor";
  }

  function silenceStatus(v: number): Status {
    if (v === 0) return "good";
    if (v <= 2) return "warn";
    return "poor";
  }

  const STATUS_COLORS: Record<Status, { dot: string; text: string; bg: string }> = {
    good:  { dot: "bg-[#0F6E56]", text: "text-[#0F6E56]", bg: "bg-green-50" },
    warn:  { dot: "bg-[#BA7517]", text: "text-[#BA7517]", bg: "bg-amber-50" },
    poor:  { dot: "bg-[#E24B4A]", text: "text-[#E24B4A]", bg: "bg-red-50" },
  };

  const metrics: {
    label: string;
    value: string;
    benchmark: string;
    status: Status;
    note?: string;
  }[] = [];

  if (duration > 0) {
    const m = Math.floor(duration / 60);
    const s = duration % 60;
    metrics.push({
      label: "Duration",
      value: `${m}m ${s}s`,
      benchmark: "≥ 1 minute",
      status: duration >= 60 ? "good" : "poor",
    });
  }

  if (wpm !== null) {
    metrics.push({
      label: "Speaking pace",
      value: `${wpm} WPM`,
      benchmark: "120–160 WPM",
      status: wpmStatus(wpm),
      note: wpm < 120 ? "Too slow — may lose listener attention" : wpm > 160 ? "Too fast — may reduce comprehension" : "Within ideal range",
    });
  }

  if (wordCount !== null) {
    metrics.push({
      label: "Words spoken",
      value: wordCount.toString(),
      benchmark: "120+ for a 1-min response",
      status: wordCount >= 120 ? "good" : wordCount >= 80 ? "warn" : "poor",
    });
  }

  if (fillerRate !== null) {
    metrics.push({
      label: "Filler word rate",
      value: fillerCount === 0 ? "None detected" : `${fillerRate}/min (${fillerCount} total)`,
      benchmark: "< 1 per minute",
      status: fillerRateStatus(fillerRate),
      note: fillerCount === 0 ? "Excellent — no fillers detected in transcript" : undefined,
    });
  }

  metrics.push({
    label: "Long pauses (4s+)",
    value: silences === 0 ? "None" : silences.toString(),
    benchmark: "0 unplanned pauses",
    status: silenceStatus(silences),
    note: silences > 0 ? "Pauses over 4 seconds disrupt listener engagement" : "No long pauses detected",
  });

  if (metrics.length === 0) return null;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <h2 className="font-semibold text-gray-900 mb-1">Session metrics</h2>
      <p className="text-xs text-gray-400 mb-4">Quantitative measurements compared to best-practice benchmarks</p>
      <div className="divide-y divide-gray-100">
        {metrics.map((m) => {
          const c = STATUS_COLORS[m.status];
          return (
            <div key={m.label} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800">{m.label}</p>
                {m.note && (
                  <p className="mt-0.5 text-xs text-gray-400">{m.note}</p>
                )}
              </div>
              <div className="flex-shrink-0 text-right space-y-0.5">
                <p className={`text-sm font-semibold ${c.text}`}>{m.value}</p>
                <p className="text-xs text-gray-400">Benchmark: {m.benchmark}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DimensionCard({ score }: { score: DimensionScore }) {
  const colors = getTierColors(score.tier);
  const label = DIMENSION_LABELS[score.dimensionKey] || score.dimensionKey;
  const description = DIMENSION_DESCRIPTIONS[score.dimensionKey];

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="font-medium text-gray-900">{label}</h3>
          {description && (
            <p className="mt-0.5 text-xs text-gray-400 leading-snug">{description}</p>
          )}
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <span className="text-xl font-bold" style={{ color: colors.hex }}>
            {score.score}
          </span>
          <span
            className="rounded px-2 py-0.5 text-xs font-medium text-white"
            style={{ backgroundColor: colors.hex }}
          >
            {score.tier}
          </span>
        </div>
      </div>

      <div className="mt-3 h-1.5 rounded-full bg-gray-100">
        <div
          className="h-1.5 rounded-full transition-all"
          style={{ width: `${score.score * 10}%`, backgroundColor: colors.hex }}
        />
      </div>

      <div className="mt-4 space-y-2">
        {score.strengthText && (
          <div className="flex gap-2">
            <span className="mt-0.5 h-4 w-4 flex-shrink-0 rounded-full bg-green-100 flex items-center justify-center">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
            </span>
            <p className="text-sm text-gray-700">{score.strengthText}</p>
          </div>
        )}
        {score.gapText && (
          <div className="flex gap-2">
            <span className="mt-0.5 h-4 w-4 flex-shrink-0 rounded-full bg-amber-100 flex items-center justify-center">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            </span>
            <p className="text-sm text-gray-700">{score.gapText}</p>
          </div>
        )}
        {score.nextStepText && (
          <div className="flex gap-2">
            <span className="mt-0.5 h-4 w-4 flex-shrink-0 rounded-full bg-blue-100 flex items-center justify-center">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
            </span>
            <p className="text-sm text-gray-700">{score.nextStepText}</p>
          </div>
        )}
      </div>
    </div>
  );
}
