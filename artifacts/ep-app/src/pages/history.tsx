import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { getRecordHref } from "@/lib/baseline";
import { api, type SessionSummary } from "@/lib/api";
import { getTierColors } from "@/lib/tier-colors";
import { Button } from "@/components/ui/button";
import { MicIcon, VideoIcon, PlusIcon, ChevronRightIcon, Trash2Icon } from "lucide-react";
import { format } from "date-fns";

export default function HistoryPage() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  const load = () => {
    api.sessions.list()
      .then(({ sessions }) => setSessions(sessions))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm("Delete this session?")) return;
    await api.sessions.delete(id);
    setSessions(prev => prev.filter(s => s.id !== id));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Session history</h1>
          <p className="mt-1 text-sm text-gray-500">All your recorded sessions</p>
        </div>
        <Button onClick={() => setLocation(getRecordHref(user))} className="gap-2">
          <PlusIcon className="h-4 w-4" />
          New session
        </Button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-gray-400">Loading…</div>
      ) : sessions.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-sm text-gray-500">No sessions yet.</p>
          <Button className="mt-4" variant="outline" onClick={() => setLocation(getRecordHref(user))}>
            Start your first session
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white divide-y divide-gray-100">
          {sessions.map(s => (
            <SessionRow
              key={s.id}
              session={s}
              onClick={() => s.processingStatus === "complete" && setLocation(`/sessions/${s.id}`)}
              onDelete={(e) => handleDelete(e, s.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SessionRow({
  session,
  onClick,
  onDelete,
}: {
  session: SessionSummary;
  onClick: () => void;
  onDelete: (e: React.MouseEvent) => void;
}) {
  const colors = session.compositeTier ? getTierColors(session.compositeTier) : null;
  const isComplete = session.processingStatus === "complete";
  const isProcessing = session.processingStatus === "processing";

  return (
    <div
      className={`flex items-center justify-between px-5 py-4 group ${isComplete ? "hover:bg-gray-50 cursor-pointer" : ""}`}
      onClick={isComplete ? onClick : undefined}
    >
      <div className="flex items-center gap-3">
        {session.mode === "audio" ? (
          <MicIcon className="h-4 w-4 text-gray-400" />
        ) : (
          <VideoIcon className="h-4 w-4 text-gray-400" />
        )}
        <div>
          <p className="text-sm font-medium text-gray-900 line-clamp-1 max-w-sm">
            {session.promptText || `${session.mode} session`}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-xs text-gray-400">
              {format(new Date(session.createdAt), "MMM d, yyyy h:mm a")}
            </p>
            {session.durationSeconds && (
              <>
                <span className="text-xs text-gray-300">·</span>
                <span className="text-xs text-gray-400">
                  {Math.floor(session.durationSeconds / 60)}m {session.durationSeconds % 60}s
                </span>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {isProcessing && (
          <span className="text-xs text-gray-400 animate-pulse">Processing…</span>
        )}
        {isComplete && session.compositeScore && (
          <span className="text-sm font-semibold text-gray-900">
            {parseFloat(session.compositeScore).toFixed(1)}
          </span>
        )}
        {isComplete && session.compositeTier && colors && (
          <span
            className="rounded px-2 py-0.5 text-xs font-medium text-white"
            style={{ backgroundColor: colors.hex }}
          >
            {session.compositeTier}
          </span>
        )}
        <button
          onClick={onDelete}
          className="opacity-0 group-hover:opacity-100 rounded p-1 hover:bg-red-50 text-gray-300 hover:text-red-500 transition-all"
        >
          <Trash2Icon className="h-4 w-4" />
        </button>
        {isComplete && <ChevronRightIcon className="h-4 w-4 text-gray-300" />}
      </div>
    </div>
  );
}
