import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { api, type SessionSummary } from "@/lib/api";
import { getTierColors, TIER_COLORS } from "@/lib/tier-colors";
import { Button } from "@/components/ui/button";
import { MicIcon, VideoIcon, TrendingUpIcon, PlusIcon, ChevronRightIcon } from "lucide-react";
import { format } from "date-fns";

export default function DashboardPage() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [, setLocation] = useLocation();

  useEffect(() => {
    api.sessions.list()
      .then(({ sessions }) => setSessions(sessions))
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <ActionCard
          icon={<MicIcon className="h-5 w-5" />}
          title="Audio session"
          description="Record and analyze your vocal delivery across 6 dimensions"
          onClick={() => setLocation("/record?mode=audio")}
        />
        <ActionCard
          icon={<VideoIcon className="h-5 w-5" />}
          title="Video session"
          description="Full 10-dimension analysis including body language and eye contact"
          onClick={() => setLocation("/record?mode=video")}
        />
      </div>
    </div>
  );
}

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

function ActionCard({
  icon,
  title,
  description,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-lg border border-gray-200 bg-white p-6 text-left hover:border-gray-400 transition-colors"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-gray-700">
        {icon}
      </div>
      <h3 className="mt-4 font-semibold text-gray-900">{title}</h3>
      <p className="mt-1 text-sm text-gray-500">{description}</p>
    </button>
  );
}
