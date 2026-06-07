import { useEffect, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { api, type SessionSummary, type ChartSession } from "@/lib/api";
import { getTierColors, PILLARS, DIMENSION_LABELS, TIER_COLORS } from "@/lib/tier-colors";
import { Button } from "@/components/ui/button";
import {
  MicIcon,
  VideoIcon,
  TrendingUpIcon,
  PlusIcon,
  ChevronRightIcon,
  ChevronDownIcon,
} from "lucide-react";
import { format } from "date-fns";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Dot,
} from "recharts";

// ─── Metric options ────────────────────────────────────────────────────────────

type MetricOption =
  | { kind: "composite" }
  | { kind: "pillar"; pillarName: string; dims: string[] }
  | { kind: "dimension"; dimKey: string };

function getMetricLabel(m: MetricOption): string {
  if (m.kind === "composite") return "Composite Score";
  if (m.kind === "pillar") return m.pillarName;
  return DIMENSION_LABELS[m.dimKey] || m.dimKey;
}

function getScore(session: ChartSession, metric: MetricOption): number | null {
  if (metric.kind === "composite") {
    const v = parseFloat(session.compositeScore || "");
    return isNaN(v) ? null : v;
  }
  if (metric.kind === "pillar") {
    const scores = metric.dims
      .map(k => session.dimensions[k])
      .filter((v): v is number => v != null);
    if (scores.length === 0) return null;
    return parseFloat((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2));
  }
  const v = session.dimensions[metric.dimKey];
  return v != null ? v : null;
}

// ─── Custom tooltip ────────────────────────────────────────────────────────────

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: { label: string; score: number | null; tier: string | null } }[];
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  if (d.score == null) return null;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-md text-sm">
      <p className="font-medium text-[#0F1B2D]">{d.score.toFixed(1)} / 10</p>
      {d.tier && <p className="text-xs text-gray-500">{d.tier}</p>}
      <p className="mt-1 text-xs text-gray-400 max-w-[160px] truncate">{d.label}</p>
    </div>
  );
}

// ─── Metric dropdown ───────────────────────────────────────────────────────────

function MetricDropdown({
  value,
  onChange,
}: {
  value: MetricOption;
  onChange: (m: MetricOption) => void;
}) {
  const [open, setOpen] = useState(false);

  const handleSelect = (m: MetricOption) => {
    onChange(m);
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:border-gray-400 transition-colors"
      >
        {getMetricLabel(value)}
        <ChevronDownIcon className="h-3.5 w-3.5 text-gray-400" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-20 mt-1 w-56 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
            <button
              onClick={() => handleSelect({ kind: "composite" })}
              className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 ${value.kind === "composite" ? "font-semibold text-[#0F1B2D]" : "text-gray-700"}`}
            >
              Composite Score
            </button>

            <div className="my-1 border-t border-gray-100" />

            {PILLARS.map(pillar => (
              <div key={pillar.name}>
                <button
                  onClick={() => handleSelect({ kind: "pillar", pillarName: pillar.name, dims: pillar.dimensions })}
                  className={`w-full px-3 py-1.5 text-left text-xs font-semibold uppercase tracking-wide hover:bg-gray-50 ${value.kind === "pillar" && (value as { kind: "pillar"; pillarName: string }).pillarName === pillar.name ? "text-[#0F1B2D]" : "text-gray-500"}`}
                >
                  {pillar.name}
                </button>
                {pillar.dimensions.map(dimKey => (
                  <button
                    key={dimKey}
                    onClick={() => handleSelect({ kind: "dimension", dimKey })}
                    className={`w-full px-5 py-1.5 text-left text-sm hover:bg-gray-50 ${value.kind === "dimension" && (value as { kind: "dimension"; dimKey: string }).dimKey === dimKey ? "font-medium text-[#0F1B2D]" : "text-gray-600"}`}
                  >
                    {DIMENSION_LABELS[dimKey] || dimKey}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function scoreToTierColor(score: number | null): string {
  if (score == null) return TIER_COLORS["Developing"].hex;
  if (score >= 8.5) return TIER_COLORS["Distinguished"].hex;
  if (score >= 6.5) return TIER_COLORS["Strong"].hex;
  if (score >= 4.0) return TIER_COLORS["Developing"].hex;
  return TIER_COLORS["Needs Focus"].hex;
}

// ─── Progress chart ────────────────────────────────────────────────────────────

function ProgressChart({
  chartSessions,
  onSessionClick,
}: {
  chartSessions: ChartSession[];
  onSessionClick: (id: string) => void;
}) {
  const [metric, setMetric] = useState<MetricOption>({ kind: "composite" });

  const chartData = [...chartSessions]
    .reverse()
    .map((s, i) => ({
      index: i,
      id: s.id,
      label: s.promptText || `${s.mode} session`,
      date: format(new Date(s.createdAt), "MMM d"),
      score: getScore(s, metric),
      tier: s.compositeTier,
    }))
    .filter(d => d.score != null);

  const handleDotClick = useCallback(
    (data: { payload?: { id?: string } }) => {
      if (data?.payload?.id) onSessionClick(data.payload.id);
    },
    [onSessionClick]
  );

  const isEmpty = chartData.length === 0;

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
        <h2 className="font-semibold text-gray-900">Progress over time</h2>
        <MetricDropdown value={metric} onChange={setMetric} />
      </div>

      {isEmpty ? (
        <div className="px-6 py-10 text-center text-sm text-gray-400">
          No data yet for this metric — complete a session to begin tracking.
        </div>
      ) : (
        <div className="px-2 py-4">
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData} margin={{ top: 10, right: 16, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F0953E" stopOpacity={0.18} />
                  <stop offset="95%" stopColor="#F0953E" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: "#9CA3AF" }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                domain={[0, 10]}
                ticks={[0, 2, 4, 6, 8, 10]}
                tick={{ fontSize: 11, fill: "#9CA3AF" }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<ChartTooltip />} />
              <ReferenceLine y={6.5} stroke="#C84A18" strokeDasharray="4 2" strokeWidth={1} label={{ value: "Strong", position: "right", fontSize: 10, fill: "#C84A18" }} />
              <ReferenceLine y={8.5} stroke="#0F1B2D" strokeDasharray="4 2" strokeWidth={1} label={{ value: "Distinguished", position: "right", fontSize: 10, fill: "#0F1B2D" }} />
              <Area
                type="monotone"
                dataKey="score"
                stroke="#F0953E"
                strokeWidth={2}
                fill="url(#scoreGrad)"
                dot={(props) => {
                  const { cx, cy, payload } = props;
                  const color = scoreToTierColor(payload.score);
                  return (
                    <Dot
                      key={payload.id}
                      cx={cx}
                      cy={cy}
                      r={5}
                      fill={color}
                      stroke="#fff"
                      strokeWidth={2}
                      style={{ cursor: "pointer" }}
                      onClick={() => handleDotClick({ payload })}
                    />
                  );
                }}
                activeDot={(props: { cx?: number; cy?: number; payload?: { id?: string; score?: number } }) => {
                  const { cx, cy, payload } = props;
                  const color = scoreToTierColor(payload?.score ?? null);
                  return (
                    <Dot
                      cx={cx}
                      cy={cy}
                      r={7}
                      fill={color}
                      stroke="#fff"
                      strokeWidth={2}
                      style={{ cursor: "pointer" }}
                      onClick={() => handleDotClick({ payload })}
                    />
                  );
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
          <p className="mt-1 text-center text-xs text-gray-400">
            Click any point to open that session
          </p>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-3 border-t border-gray-100 pt-4">
            {(
              [
                ["Needs Focus", "1.0–3.9"],
                ["Developing", "4.0–6.4"],
                ["Strong", "6.5–8.4"],
                ["Distinguished", "8.5–10.0"],
              ] as const
            ).map(([tier, range]) => {
              const c = TIER_COLORS[tier];
              return (
                <div key={tier} className="flex items-center gap-1.5">
                  <span
                    className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: c.hex }}
                  />
                  <span className="text-xs text-gray-600 font-medium">{tier}</span>
                  <span className="text-xs text-gray-400">{range}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [chartSessions, setChartSessions] = useState<ChartSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [, setLocation] = useLocation();

  useEffect(() => {
    Promise.all([
      api.sessions.list().then(({ sessions }) => sessions),
      api.sessions.chart().then(({ sessions }) => sessions).catch(() => [] as ChartSession[]),
    ])
      .then(([list, chart]) => {
        setSessions(list);
        setChartSessions(chart);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const completed = sessions.filter(s => s.processingStatus === "complete");
  const recent = completed.slice(0, 5);

  const avgScore = completed.length > 0
    ? (completed.reduce((sum, s) => sum + parseFloat(s.compositeScore || "0"), 0) / completed.length).toFixed(1)
    : null;

  const latestTier = completed[0]?.compositeTier;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back{user?.name ? `, ${user.name.split(" ")[0]}` : ""}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Track and improve your executive presence
          </p>
        </div>
        <Button onClick={() => setLocation("/record")} className="gap-2">
          <PlusIcon className="h-4 w-4" />
          New session
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Sessions completed"
          value={completed.length.toString()}
          icon={<TrendingUpIcon className="h-5 w-5 text-gray-400" />}
        />
        <StatCard
          label="Average score"
          value={avgScore ? `${avgScore}/10` : "—"}
          icon={<TrendingUpIcon className="h-5 w-5 text-gray-400" />}
        />
        <StatCard
          label="Current tier"
          value={latestTier || "—"}
          tierColor={latestTier ? getTierColors(latestTier).hex : undefined}
          icon={<TrendingUpIcon className="h-5 w-5 text-gray-400" />}
        />
      </div>

      {!loading && chartSessions.length > 0 && (
        <ProgressChart
          chartSessions={chartSessions}
          onSessionClick={id => setLocation(`/sessions/${id}`)}
        />
      )}

      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="font-semibold text-gray-900">Recent sessions</h2>
          <button
            onClick={() => setLocation("/history")}
            className="text-sm text-gray-500 hover:text-gray-900"
          >
            View all
          </button>
        </div>
        {loading ? (
          <div className="px-6 py-8 text-center text-sm text-gray-400">Loading…</div>
        ) : recent.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-gray-500">No sessions yet.</p>
            <Button onClick={() => setLocation("/record")} className="mt-4 gap-2" variant="outline">
              <PlusIcon className="h-4 w-4" />
              Start your first session
            </Button>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {recent.map(s => (
              <SessionRow key={s.id} session={s} onClick={() => setLocation(`/sessions/${s.id}`)} />
            ))}
          </ul>
        )}
      </div>

      <button
        onClick={() => setLocation("/record")}
        className="group relative w-full overflow-hidden rounded-2xl px-8 py-7 text-left transition-opacity hover:opacity-90 active:opacity-80"
        style={{ background: "linear-gradient(120deg, #F0953E 0%, #C84A18 100%)" }}
      >
        <div className="relative z-10 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-white/70 mb-1">
              {recent.length === 0 ? "Get started" : "New session"}
            </p>
            <p className="text-xl font-semibold text-white leading-snug">
              {recent.length === 0
                ? "Record your first session"
                : "Record again"}
            </p>
            <p className="mt-1 text-sm text-white/75">
              {recent.length === 0
                ? "Speak for 60 seconds and get feedback across 11 dimensions"
                : "Keep building — consistency is what drives improvement"}
            </p>
          </div>
          <ChevronRightIcon className="h-6 w-6 shrink-0 text-white/60 transition-transform group-hover:translate-x-1" />
        </div>
      </button>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon,
  tierColor,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tierColor?: string;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-6 py-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500">{label}</span>
        {icon}
      </div>
      <p
        className="mt-2 text-2xl font-bold"
        style={tierColor ? { color: tierColor } : { color: "#111827" }}
      >
        {value}
      </p>
    </div>
  );
}

function SessionRow({ session, onClick }: { session: SessionSummary; onClick: () => void }) {
  const colors = session.compositeTier ? getTierColors(session.compositeTier) : null;
  return (
    <li>
      <button
        onClick={onClick}
        className="flex w-full items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          {session.mode === "audio" ? (
            <MicIcon className="h-4 w-4 text-gray-400" />
          ) : (
            <VideoIcon className="h-4 w-4 text-gray-400" />
          )}
          <div>
            <p className="text-sm font-medium text-gray-900 line-clamp-1">
              {session.promptText || `${session.mode} session`}
            </p>
            <p className="text-xs text-gray-400">
              {format(new Date(session.createdAt), "MMM d, yyyy")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {session.compositeScore && (
            <span className="text-sm font-semibold text-gray-900">
              {parseFloat(session.compositeScore).toFixed(1)}
            </span>
          )}
          {session.compositeTier && colors && (
            <span
              className="rounded px-2 py-0.5 text-xs font-medium text-white"
              style={{ backgroundColor: colors.hex }}
            >
              {session.compositeTier}
            </span>
          )}
          <ChevronRightIcon className="h-4 w-4 text-gray-300" />
        </div>
      </button>
    </li>
  );
}
