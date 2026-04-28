import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { MicIcon, VideoIcon, BarChart2Icon } from "lucide-react";

const STEPS = [
  {
    number: "1",
    icon: <MicIcon className="h-5 w-5 text-amber-500" />,
    title: "Choose a prompt",
    body: "Select a professional scenario or write your own.",
  },
  {
    number: "2",
    icon: <VideoIcon className="h-5 w-5 text-amber-500" />,
    title: "Record",
    body: "Record your response in audio or video mode. Sessions run 1 to 10 minutes.",
  },
  {
    number: "3",
    icon: <BarChart2Icon className="h-5 w-5 text-amber-500" />,
    title: "Get your scores and coaching",
    body: "Receive scores and evidence-based feedback across up to 15 dimensions of executive presence.",
  },
];

const BETA_LIMIT_SECONDS = 1200;

export default function WelcomePage() {
  const [, setLocation] = useLocation();
  const { user, refreshUser } = useAuth();

  const totalRecordingSeconds = user?.totalRecordingSeconds ?? 0;
  const quotaUsedMins = Math.floor(totalRecordingSeconds / 60);
  const quotaUsedSecs = totalRecordingSeconds % 60;

  const handleBegin = async () => {
    try {
      await api.users.markWelcomeSeen();
      await refreshUser();
    } catch {
      // non-fatal — proceed anyway
    }
    setLocation("/record");
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">How it works</h1>
        <p className="mt-1 text-sm text-gray-500">
          Your personal executive presence coach — powered by AI.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {STEPS.map((step) => (
          <div
            key={step.number}
            className="rounded-lg border border-gray-200 bg-white px-5 py-5 space-y-3"
            style={{ borderTop: "3px solid rgb(245 158 11)" }}
          >
            <div className="flex items-center gap-2">
              {step.icon}
              <span className="text-xs font-semibold uppercase tracking-widest text-amber-500">
                Step {step.number}
              </span>
            </div>
            <h3 className="text-base font-semibold text-gray-900">{step.title}</h3>
            <p className="text-sm text-gray-500 leading-relaxed">{step.body}</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-gray-200 bg-white px-6 py-5 space-y-1">
        <p className="text-sm font-semibold text-gray-900">Your progress unlocks after two sessions</p>
        <p className="text-sm text-gray-500">
          Once you've completed two recordings, your Progress page activates — showing how your
          scores are moving across every dimension, where you're improving, and where to focus next.
        </p>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white px-6 py-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold text-gray-900">Beta recording allowance</p>
          <p className="text-sm font-mono text-gray-700">
            {quotaUsedMins}m {quotaUsedSecs.toString().padStart(2, "0")}s
            <span className="text-gray-400"> / 20m used</span>
          </p>
        </div>
        <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-gray-800 transition-all"
            style={{ width: `${Math.min(100, (totalRecordingSeconds / BETA_LIMIT_SECONDS) * 100)}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-gray-400">
          {Math.max(0, BETA_LIMIT_SECONDS - totalRecordingSeconds)} seconds remaining in your beta allowance.
        </p>
      </div>

      {!user?.hasSeenWelcome && (
        <div className="flex flex-col items-start gap-3">
          <Button onClick={handleBegin} className="px-8">
            Let's begin →
          </Button>
          <p className="text-xs text-gray-400 max-w-lg leading-relaxed">
            Built on McKinsey-level analytical rigour and Executive Coaching methodology. Your
            recording is deleted immediately after scoring. During beta, transcripts are accessible
            to the Gravitas team for scoring validation only.
          </p>
        </div>
      )}
    </div>
  );
}
