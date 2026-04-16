import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { api, type SessionSummary } from "@/lib/api";
import { getTierColors, DIMENSION_LABELS } from "@/lib/tier-colors";
import { Button } from "@/components/ui/button";
import { PlusIcon } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { format } from "date-fns";

export default function ProgressPage() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [, setLocation] = useLocation();

  useEffect(() => {
    api.sessions.progress()
      .then(({ sessions }) => setSessions(sessions))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const chartData = [...sessions].reverse().map(s => ({
    date: format(new Date(s.createdAt), "MMM d"),
    score: parseFloat(s.compositeScore || "0"),
    tier: s.compositeTier,
  }));

  const tierBands = [
    { y: 1, label: "Emerging", color: "#E24B4A" },
    { y: 4, label: "Developing", color: "#BA7517" },
    { y: 6, label: "Strong", color: "#0F6E56" },
    { y: 8, label: "Distinguished", color: "#534AB7" },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Your progress</h1>
          <p className="mt-1 text-sm text-gray-500">Track your executive presence over time</p>
        </div>
        <Button onClick={() => setLocation("/record")} className="gap-2">
          <PlusIcon className="h-4 w-4" />
          New session
        </Button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-gray-400">Loading…</div>
      ) : sessions.length < 2 ? (
        <div className="rounded-lg border border-gray-200 bg-white py-16 text-center">
          <p className="text-sm text-gray-500">Complete at least 2 sessions to see your progress trend.</p>
          <Button className="mt-4" variant="outline" onClick={() => setLocation("/record")}>
            Start a session
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Composite score over time</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 10]} tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                <Tooltip
                  content={({ payload }) => {
                    if (!payload?.length) return null;
                    const d = payload[0].payload;
                    const colors = d.tier ? getTierColors(d.tier) : null;
                    return (
                      <div className="rounded border border-gray-200 bg-white px-3 py-2 shadow-sm">
                        <p className="text-xs text-gray-400">{d.date}</p>
                        <p className="text-sm font-bold" style={colors ? { color: colors.hex } : {}}>
                          {d.score.toFixed(1)} — {d.tier}
                        </p>
                      </div>
                    );
                  }}
                />
                {tierBands.map(b => (
                  <ReferenceLine
                    key={b.label}
                    y={b.y}
                    stroke={b.color}
                    strokeDasharray="4 4"
                    strokeOpacity={0.3}
                    label={{ value: b.label, position: "right", fontSize: 10, fill: b.color }}
                  />
                ))}
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="#534AB7"
                  strokeWidth={2}
                  dot={{ r: 4, fill: "#534AB7" }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {sessions.length > 0 && <TierLegend />}
    </div>
  );
}

function TierLegend() {
  const tiers = [
    { name: "Emerging", range: "1–3", hex: "#E24B4A" },
    { name: "Developing", range: "4–5", hex: "#BA7517" },
    { name: "Strong", range: "6–7", hex: "#0F6E56" },
    { name: "Distinguished", range: "8–10", hex: "#534AB7" },
  ];
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">Score tiers</h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiers.map(t => (
          <div key={t.name} className="flex items-center gap-2">
            <span
              className="h-3 w-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: t.hex }}
            />
            <div>
              <p className="text-sm font-medium" style={{ color: t.hex }}>{t.name}</p>
              <p className="text-xs text-gray-400">{t.range}/10</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
