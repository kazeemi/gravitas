import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { api, type SessionDetail } from "@/lib/api";
import { getTierColors, DIMENSION_LABELS } from "@/lib/tier-colors";
import { Button } from "@/components/ui/button";
import { ChevronLeftIcon, MicIcon, VideoIcon, AlertTriangleIcon } from "lucide-react";
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer } from "recharts";
import { format } from "date-fns";

export default function SessionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!id) return;
    api.sessions.get(id)
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

  const radarData = session.dimensionScores.map(d => ({
    subject: (DIMENSION_LABELS[d.dimensionKey] || d.dimensionKey).split(" & ").join("\n& "),
    score: d.score,
    fullMark: 10,
  }));

  return (
    <div className="max-w-3xl mx-auto space-y-8">
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
              <p className="mt-2 text-gray-700">{session.promptText}</p>
            )}
          </div>
          {score !== null && colors && (
            <div className="text-right">
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
      </div>

      {radarData.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Score overview</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid stroke="#e5e7eb" />
                <PolarAngleAxis
                  dataKey="subject"
                  tick={{ fontSize: 11, fill: "#6b7280" }}
                />
                <Radar
                  name="Score"
                  dataKey="score"
                  stroke={colors?.hex || "#534AB7"}
                  fill={colors?.hex || "#534AB7"}
                  fillOpacity={0.15}
                  strokeWidth={2}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <h2 className="font-semibold text-gray-900">Dimension feedback</h2>
        {session.dimensionScores.map(d => (
          <DimensionCard key={d.id} score={d} />
        ))}
      </div>

      <div className="flex gap-3 pb-8">
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

function DimensionCard({ score }: { score: import("@/lib/api").DimensionScore }) {
  const colors = getTierColors(score.tier);
  const label = DIMENSION_LABELS[score.dimensionKey] || score.dimensionKey;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-gray-900">{label}</h3>
        <div className="flex items-center gap-2">
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
