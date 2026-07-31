import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { getRecordHref } from "@/lib/baseline";
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
  const { user } = useAuth();

  useEffect(() => {
    api.sessions.progress()
      .then(({ sessions }) => setSessions(sessions))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const chartData = [...sessions].reverse().map((s, i) => ({
    date: format(new Date(s.createdAt), "MMM d"),
    score: parseFloat(s.compositeScore || "0"),
    tier: s.compositeTier,
    key: `${s.id ?? i}`,
  }));

  const tierBands = [
    { y: 1, label: "Needs Focus", color: "#78736A" },
    { y: 4, label: "Developing", color: "#F0953E" },
    { y: 6.5, label: "Strong", color: "#C84A18" },
    { y: 8.5, label: "Distinguished", color: "#0F1B2D" },
  ];

  const hasMixedVersions = sessions.some(s => (s as SessionSummary & { methodologyVersion?: string }).methodologyVersion !== "4.0");

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Your progress</h1>
          <p className="mt-1 text-sm text-gray-500">Track your executive presence over time</p>
        </div>
        <Button onClick={() => setLocation(getRecordHref(user))} className="gap-2">
          <PlusIcon className="h-4 w-4" />
          New session
        </Button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-gray-400">Loading…</div>
      ) : sessions.length < 2 ? (
        <div className="rounded-lg border border-gray-200 bg-white py-16 text-center">
          <p className="text-sm text-gray-500">Complete at least 2 sessions to see your progress trend.</p>
          <Button className="mt-4" variant="outline" onClick={() => setLocation(getRecordHref(user))}>
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
                  stroke="#9ca3af"
                  strokeWidth={2}
                  dot={(props: { cx?: number; cy?: number; index?: number; payload?: { tier?: string; key?: string } }) => {
                    const { cx = 0, cy = 0, index = 0, payload } = props;
                    const colors = payload?.tier ? getTierColors(payload.tier) : null;
                    return (
                      <circle
                        key={payload?.key ?? `dot-${index}`}
                        cx={cx}
                        cy={cy}
                        r={5}
                        fill={colors ? colors.hex : "#9ca3af"}
                        stroke="white"
                        strokeWidth={1.5}
                      />
                    );
                  }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {sessions.length > 0 && hasMixedVersions && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-xs text-amber-800">
            <span className="font-medium">Mixed methodology versions:</span> These sessions were scored using different methodology versions. They show your development over time but cannot be compared as exact like-for-like numbers.
          </p>
        </div>
      )}
      {sessions.length > 0 && <TierLegend />}
    </div>
  );
}

function TierLegend() {
  const tiers = [
    { name: "Needs Focus", range: "1.0–3.9", dotColor: "#EDE8E2", textColor: "#78736A" },
    { name: "Developing", range: "4.0–6.4", dotColor: "#F0953E", textColor: "#F0953E" },
    { name: "Strong", range: "6.5–8.4", dotColor: "#C84A18", textColor: "#C84A18" },
    { name: "Distinguished", range: "8.5–10", dotColor: "#0F1B2D", textColor: "#0F1B2D" },
  ];
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">Score tiers</h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiers.map(t => (
          <div key={t.name} className="flex items-center gap-2">
            <span
              className="h-3 w-3 rounded-full flex-shrink-0 border"
              style={{ backgroundColor: t.dotColor, borderColor: t.textColor }}
            />
            <div>
              <p className="text-sm font-medium" style={{ color: t.textColor }}>{t.name}</p>
              <p className="text-xs text-gray-400">{t.range}/10</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
