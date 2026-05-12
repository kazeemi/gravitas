import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { api, type SessionDetail, type DimensionScore, type SessionSummary } from "@/lib/api";
import { getTierColors, DIMENSION_LABELS, DIMENSION_DISPLAY_ORDER, PILLARS } from "@/lib/tier-colors";
import { Button } from "@/components/ui/button";
import {
  ChevronLeftIcon,
  ChevronDownIcon,
  MicIcon,
  VideoIcon,
  AlertTriangleIcon,
  InfoIcon,
  DownloadIcon,
  XIcon,
} from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/lib/auth-context";
import { downloadSessionPdf } from "@/lib/export-pdf";

function scoreToTier(score: number): string {
  if (score < 4) return "Needs Focus";
  if (score < 6.5) return "Developing";
  if (score < 8.5) return "Strong";
  return "Distinguished";
}

interface OverallFeedback {
  summaryStrengths?: string[];
  summaryImprovements?: string[];
  priorityAction?: string | null;
  priorityActions?: string[];
  recordAgainPrompt?: string | null;
  motivationalMessage?: string | null;
  needsFocusPreamble?: string | null;
  noStrengthsLine?: string | null;
  strengths?: string;
  improvements?: string;
  nextStep?: string;
  gatingNote?: string;
  innerWorkEscalation?: string;
}

function parseOverallFeedback(raw: string | null): OverallFeedback | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as OverallFeedback;
  } catch {
    return { strengths: raw };
  }
}

function sentencesToBullets(text: string, max = 3): string[] {
  if (!text) return [];
  const sentences = text.match(/[^.!?]+[.!?]+/g);
  if (sentences && sentences.length > 1) {
    return sentences.map(s => s.trim()).filter(Boolean).slice(0, max);
  }
  return [text.trim()];
}

function getStrengthBullets(fb: OverallFeedback): string[] {
  if (fb.summaryStrengths && fb.summaryStrengths.length > 0) return fb.summaryStrengths.slice(0, 3);
  if (fb.strengths && !fb.strengths.startsWith("Unable to")) return sentencesToBullets(fb.strengths);
  return [];
}

function getImprovementBullets(fb: OverallFeedback): string[] {
  if (fb.summaryImprovements && fb.summaryImprovements.length > 0) return fb.summaryImprovements.slice(0, 3);
  if (fb.improvements) return sentencesToBullets(fb.improvements);
  return [];
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function pick<T>(arr: T[], seed: string): T {
  return arr[hashStr(seed) % arr.length];
}

function getContextualFallbackMessage(
  sessionId: string,
  sessionNumber: number,
  tier: string,
  currentScore: number | null,
  previousScore: number | null,
): string {
  const delta = currentScore !== null && previousScore !== null ? currentScore - previousScore : null;
  const isNeedsFocus = tier === "Needs Focus";

  const FIRST_SESSION = [
    "This is where it starts — and you just made the move most people only think about.",
    "Starting is the hardest part, and you did it. Everything that follows builds on this.",
    "The first recording is the real barrier. You're past it — now the work begins.",
  ];

  const BIG_WIN = [
    "That is a real jump — whatever you have been doing, it is working. Keep going.",
    "Your presence has shifted significantly. You can feel it, and so can we. Keep the momentum.",
    "That kind of progress does not happen by accident. You earned it.",
    "Something has clicked — and it is showing up in a big way. This is what the work looks like.",
  ];

  const SOLID_WIN = [
    "Something has shifted since your last session — and it is showing up clearly.",
    "The work is registering. Your presence is building in a way that is hard to miss.",
    "You came back and it moved. That is the whole point — consistency translates.",
    "Real progress. The gap between where you started and where you are now is growing.",
  ];

  const CAME_BACK_2 = [
    "You came back. That matters more than most people realise — the habit starts here.",
    "Two sessions in. Most people never get here. You did, and that gap matters.",
    "Coming back for a second session puts you ahead of most people who think about doing this.",
    "The hardest part after starting is returning. You did both.",
  ];

  const AFFIRMING = [
    "Showing up when it is hard is exactly the work. You are doing it.",
    "Every session you come back to is a session that compounds later. This one counts.",
    "This session gives you a clear direction. That clarity is worth something.",
    "Coming back takes more resolve than people give it credit for. You showed up.",
  ];

  const CONSISTENCY = [
    "The consistency is the work — and you keep doing it.",
    "Every session you show up for builds on the last. This one counts.",
    "You keep coming back and it keeps showing — this is what development actually looks like.",
    "The pattern is there. Every recording compounds. Keep going.",
    "Most people stop here. You did not. That is the difference.",
  ];

  if (sessionNumber === 1) return pick(FIRST_SESSION, sessionId);
  if (isNeedsFocus || (delta !== null && delta <= -0.5)) return pick(AFFIRMING, sessionId);
  if (delta !== null && delta >= 1.0) return pick(BIG_WIN, sessionId);
  if (delta !== null && delta >= 0.5) return pick(SOLID_WIN, sessionId);
  if (sessionNumber === 2) return pick(CAME_BACK_2, sessionId);
  return pick(CONSISTENCY, sessionId);
}

function getSummaryLabels(tier: string): { left: string; right: string } {
  switch (tier) {
    case "Distinguished": return { left: "What makes you exceptional", right: "What would make you even greater" };
    case "Strong": return { left: "What makes you great", right: "What would make you even greater" };
    case "Developing": return { left: "What's working well", right: "What's worth working on" };
    default: return { left: "What's already there", right: "What needs your attention most" };
  }
}

export default function SessionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [allSessions, setAllSessions] = useState<SessionSummary[]>([]);
  const [generatedMessage, setGeneratedMessage] = useState<string | null>(null);
  const [promptModalOpen, setPromptModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedDimKey, setExpandedDimKey] = useState<string | null>(null);
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    if (!id) return;
    api.sessions
      .get(id)
      .then(setSession)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    api.sessions.list().then(data => setAllSessions(data.sessions)).catch(() => {});
  }, []);

  // For sessions without a stored motivational message, generate one via AI
  useEffect(() => {
    if (!session || !id) return;
    let feedback: Record<string, unknown> = {};
    try { feedback = JSON.parse(session.overallFeedback ?? "{}"); } catch {}
    if (feedback.motivationalMessage) return; // already stored — no need to generate
    api.sessions.generateMotivationalMessage(id)
      .then(data => setGeneratedMessage(data.message))
      .catch(() => {}); // silently fall back to static message
  }, [session, id]);

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
        <Button className="mt-4" variant="outline" onClick={() => setLocation("/dashboard")}>
          Back to Dashboard
        </Button>
      </div>
    );
  }

  const colors = session.compositeTier ? getTierColors(session.compositeTier) : null;
  const score = session.compositeScore ? parseFloat(session.compositeScore) : null;
  const overallFeedback = parseOverallFeedback(session.overallFeedback ?? null);
  const methodologyVersion = (session as SessionDetail & { methodologyVersion?: string }).methodologyVersion;
  const isLegacySession = methodologyVersion && methodologyVersion !== "4.0";

  const sortedDimensions = [...session.dimensionScores].sort((a, b) => {
    const ai = DIMENSION_DISPLAY_ORDER.indexOf(a.dimensionKey);
    const bi = DIMENSION_DISPLAY_ORDER.indexOf(b.dimensionKey);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });

  const dimensionsByPillar = PILLARS.map(pillar => ({
    pillar,
    dimensions: sortedDimensions.filter(d => pillar.dimensions.includes(d.dimensionKey)),
  })).filter(g => g.dimensions.length > 0);

  const noAudioDetected = session.dimensionScores.length === 0 && !session.compositeScore;
  const hasSilences = (session.silenceEvents ?? 0) > 0;
  const transcriptWordCount = session.transcript
    ? session.transcript.trim().split(/\s+/).filter(Boolean).length
    : 0;
  const hasLowEngagement = transcriptWordCount < 50 && transcriptWordCount > 0;
  const gatingNote = overallFeedback?.gatingNote;

  // Derive session number and previous score from session history for the fallback message
  const completedByDate = [...allSessions]
    .filter(s => s.processingStatus === "complete" && s.compositeScore)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const sessionIndex = completedByDate.findIndex(s => s.id === id);
  const derivedSessionNumber = sessionIndex >= 0 ? sessionIndex + 1 : 1;
  const derivedPreviousScore = sessionIndex > 0 && completedByDate[sessionIndex - 1].compositeScore
    ? parseFloat(completedByDate[sessionIndex - 1].compositeScore!)
    : null;

  const tier = session.compositeTier || "Developing";
  const labels = getSummaryLabels(tier);
  const isNeedsFocus = tier === "Needs Focus";
  const strengthBullets = overallFeedback ? getStrengthBullets(overallFeedback) : [];
  const improvementBullets = overallFeedback ? getImprovementBullets(overallFeedback) : [];
  const priorityActions = overallFeedback?.priorityActions || [];
  const effectivePriorityAction =
    overallFeedback?.priorityAction ||
    (!isNeedsFocus ? overallFeedback?.nextStep : null);

  return (
    <>
    <div className="max-w-2xl mx-auto pb-12">
      {/* Navigation */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => setLocation("/dashboard")}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900"
        >
          <ChevronLeftIcon className="h-4 w-4" />
          Back
        </button>
        <button
          onClick={() => downloadSessionPdf(session, user?.name ?? null)}
          className="flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
        >
          <DownloadIcon className="h-3.5 w-3.5" />
          Export PDF
        </button>
      </div>

      {/* No audio detected */}
      {noAudioDetected && (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <div className="flex items-center gap-2 text-sm text-gray-400 mb-3">
            {session.mode === "audio" ? <MicIcon className="h-4 w-4" /> : <VideoIcon className="h-4 w-4" />}
            <span className="capitalize">{session.mode}</span>
            <span>·</span>
            <span>{format(new Date(session.createdAt), "MMM d, yyyy")}</span>
          </div>
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
            <AlertTriangleIcon className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-red-700">
              <p className="font-medium">No audio was detected in this recording.</p>
              <p className="mt-1">Your microphone was active but no speech reached the server. Please try again — speak clearly from the very start and ensure your browser has microphone permission.</p>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 1 — Top summary card */}
      {!noAudioDetected && score !== null && colors && overallFeedback && (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">

          {/* Score + metadata */}
          <div className="px-6 pt-6 pb-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-6xl font-bold leading-none tracking-tight" style={{ color: colors.hex }}>
                  {score.toFixed(1)}
                </p>
                <p className="mt-2 text-xs font-semibold uppercase tracking-widest" style={{ color: colors.hex }}>
                  {tier}
                </p>
              </div>
              <div className="text-right flex-shrink-0 min-w-0">
                <div className="flex items-center gap-1.5 text-xs text-gray-400 justify-end flex-wrap">
                  {session.mode === "audio" ? <MicIcon className="h-3.5 w-3.5" /> : <VideoIcon className="h-3.5 w-3.5" />}
                  <span className="capitalize">{session.mode}</span>
                  <span>·</span>
                  <span>{format(new Date(session.createdAt), "MMM d, yyyy")}</span>
                  {session.durationSeconds && (
                    <>
                      <span>·</span>
                      <span>{Math.floor(session.durationSeconds / 60)}m {session.durationSeconds % 60}s</span>
                    </>
                  )}
                </div>
                {session.promptText && (
                  <div className="mt-1 text-right">
                    <p className="text-xs text-gray-500 max-w-[220px] leading-snug line-clamp-2 inline">
                      {session.promptText}
                    </p>
                    {session.promptText.length > 80 && (
                      <button
                        onClick={() => setPromptModalOpen(true)}
                        className="ml-1 text-xs text-gray-400 hover:text-gray-700 underline underline-offset-2 whitespace-nowrap transition-colors"
                      >
                        more
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Motivational message */}
            <p className="mt-4 text-sm leading-relaxed" style={{ color: "#6B6560" }}>
              {overallFeedback.motivationalMessage || generatedMessage || getContextualFallbackMessage(session.id, derivedSessionNumber, tier, score, derivedPreviousScore)}
            </p>

            {/* Notices */}
            {isLegacySession && (
              <div className="mt-4 flex items-start gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
                <InfoIcon className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-gray-600">
                  <span className="font-medium">Scored under v{methodologyVersion}.</span> Scores are not directly comparable to v4.0 sessions.
                </p>
              </div>
            )}
            {gatingNote && (
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                <InfoIcon className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber-800">{gatingNote}</p>
              </div>
            )}
            {(session.audioQualityFlag || session.faceCoverageFlag) && (
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                <AlertTriangleIcon className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber-700">
                  {session.audioQualityFlag && "Audio quality issues detected — scores may be less accurate. "}
                  {session.faceCoverageFlag && "Face not consistently visible — video scores may be less accurate."}
                </p>
              </div>
            )}
            {hasSilences && (
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                <AlertTriangleIcon className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber-700">
                  {session.silenceEvents} extended pause{session.silenceEvents !== 1 ? "s" : ""} detected — these disrupt listener engagement and affect your pacing score.
                </p>
              </div>
            )}
            {hasLowEngagement && (
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-orange-200 bg-orange-50 p-3">
                <AlertTriangleIcon className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-orange-700">
                  <span className="font-medium">Limited response</span> — only ~{transcriptWordCount} words transcribed. Content dimension scores may not be fully representative.
                </p>
              </div>
            )}
          </div>

          {/* Two-column summary */}
          <div className="border-t border-gray-100 grid grid-cols-2 gap-px bg-gray-100">
            <div className="bg-white px-5 py-5">
              <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "#2e2d29" }}>
                {labels.left}
              </p>
              {overallFeedback.noStrengthsLine ? (
                <p className="text-sm text-gray-500 italic leading-relaxed">{overallFeedback.noStrengthsLine}</p>
              ) : strengthBullets.length > 0 ? (
                <ul className="space-y-2.5">
                  {strengthBullets.map((bullet, i) => (
                    <li key={i} className="flex gap-2.5 text-sm text-gray-700 leading-snug">
                      <span className="flex-shrink-0 mt-[5px] h-1.5 w-1.5 rounded-full bg-gray-300" />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-400 italic">No strengths identified for this session.</p>
              )}
            </div>

            <div className="bg-white px-5 py-5">
              <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "#2e2d29" }}>
                {labels.right}
              </p>
              {improvementBullets.length > 0 ? (
                <ul className="space-y-2.5">
                  {improvementBullets.map((bullet, i) => (
                    <li key={i} className="flex gap-2.5 text-sm text-gray-700 leading-snug">
                      <span className="flex-shrink-0 mt-[5px] h-1.5 w-1.5 rounded-full bg-gray-300" />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-400 italic">No specific development areas identified.</p>
              )}
            </div>
          </div>

          {/* Priority action(s) */}
          {(effectivePriorityAction || (isNeedsFocus && priorityActions.length > 0)) && (
            <div className="border-t border-gray-100 px-6 py-5 bg-[#FBF7F2]">
              {isNeedsFocus && priorityActions.length > 0 ? (
                <>
                  {overallFeedback.needsFocusPreamble && (
                    <p className="text-xs text-gray-500 mb-4 leading-relaxed italic">
                      {overallFeedback.needsFocusPreamble}
                    </p>
                  )}
                  <div className="space-y-3">
                    {priorityActions.map((action, i) => (
                      <div key={i} className="flex gap-3">
                        <span className="flex-shrink-0 h-5 w-5 rounded-full bg-[#F0953E]/20 flex items-center justify-center text-xs font-bold text-[#C84A18]">
                          {i + 1}
                        </span>
                        <p className="text-sm text-gray-700 leading-snug">{action}</p>
                      </div>
                    ))}
                  </div>
                </>
              ) : effectivePriorityAction ? (
                <>
                  <p className="text-xs font-semibold uppercase tracking-widest text-[#C84A18] mb-2">
                    Focus for your next recording
                  </p>
                  <p className="text-sm text-gray-700 leading-relaxed">{effectivePriorityAction}</p>
                </>
              ) : null}
            </div>
          )}

          {/* Inner work escalation */}
          {overallFeedback.innerWorkEscalation && (
            <div className="border-t border-gray-100 px-6 py-4 bg-gray-50">
              <p className="text-xs text-gray-500 leading-relaxed">{overallFeedback.innerWorkEscalation}</p>
            </div>
          )}
        </div>
      )}

      {/* SECTION 2 — Pillar headers + dimension cards */}
      {!noAudioDetected && dimensionsByPillar.length > 0 && (
        <div className="mt-6 space-y-7">
          {dimensionsByPillar.map(({ pillar, dimensions }) => {
            const avgScore = dimensions.reduce((sum, d) => sum + d.score, 0) / dimensions.length;
            const avgColors = getTierColors(scoreToTier(avgScore));
            return (
              <div key={pillar.name}>
                <div className="flex items-baseline justify-between px-1 mb-2">
                  <h3 className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#2e2d29" }}>
                    {pillar.name}
                  </h3>
                  <span className="text-sm font-bold tabular-nums" style={{ color: avgColors.hex }}>
                    {avgScore.toFixed(1)}
                  </span>
                </div>
                <div className="h-px bg-gray-100 mb-3" />
                <div className="space-y-2">
                  {dimensions.map(d => (
                    <DimensionCard
                      key={d.id}
                      score={d}
                      isExpanded={expandedDimKey === d.dimensionKey}
                      onToggle={() =>
                        setExpandedDimKey(expandedDimKey === d.dimensionKey ? null : d.dimensionKey)
                      }
                    />
                  ))}
                </div>
              </div>
            );
          })}

          {/* Ungrouped dimensions (legacy sessions) */}
          {(() => {
            const allPillarDims = PILLARS.flatMap(p => p.dimensions);
            const ungrouped = sortedDimensions.filter(d => !allPillarDims.includes(d.dimensionKey));
            if (ungrouped.length === 0) return null;
            return (
              <div>
                <div className="flex items-baseline justify-between px-1 mb-2">
                  <h3 className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#2e2d29" }}>Other</h3>
                </div>
                <div className="h-px bg-gray-100 mb-3" />
                <div className="space-y-2">
                  {ungrouped.map(d => (
                    <DimensionCard
                      key={d.id}
                      score={d}
                      isExpanded={expandedDimKey === d.dimensionKey}
                      onToggle={() =>
                        setExpandedDimKey(expandedDimKey === d.dimensionKey ? null : d.dimensionKey)
                      }
                    />
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* SECTION 3 — Session metrics (collapsed) */}
      {!noAudioDetected && <CollapsibleMetrics session={session} />}

      {/* SECTION 4 — Transcript (collapsed) */}
      {!noAudioDetected && <CollapsibleTranscript session={session} />}

      {/* SECTION 5 — Record Again (always visible, never collapsed) */}
      {!noAudioDetected && (
        <div className="mt-6 rounded-xl overflow-hidden" style={{ background: "#0F1B2D" }}>
          <div className="px-6 pt-6 pb-5">
            <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "#F0953E" }}>
              What's next
            </p>
            <p className="text-base leading-relaxed mb-5" style={{ color: "rgba(255,255,255,0.88)" }}>
              {overallFeedback?.recordAgainPrompt ||
                "The insight from this session is most valuable when tested immediately — record again now and see what shifts."}
            </p>
            <button
              onClick={() => setLocation(session.promptText ? `/record?prompt=${encodeURIComponent(session.promptText)}` : "/record")}
              className="w-full rounded-lg py-3.5 text-sm font-bold tracking-wide transition-colors"
              style={{ background: "#F0953E", color: "#fff" }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "#C84A18"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "#F0953E"; }}
            >
              Record again
            </button>
          </div>
          <div className="px-6 py-3 flex justify-between items-center" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
              {format(new Date(session.createdAt), "MMM d, yyyy")}
            </span>
            <button
              className="text-xs transition-colors"
              style={{ color: "rgba(255,255,255,0.25)" }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#f87171"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.25)"; }}
              onClick={async () => {
                if (!confirm("Delete this session?")) return;
                await api.sessions.delete(session.id);
                setLocation("/history");
              }}
            >
              Delete session
            </button>
          </div>
        </div>
      )}
    </div>

    {/* Prompt full-text modal */}
    {promptModalOpen && session?.promptText && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ backgroundColor: "rgba(15,27,45,0.5)" }}
        onClick={() => setPromptModalOpen(false)}
      >
        <div
          className="relative w-full max-w-lg rounded-2xl bg-white p-7 shadow-2xl"
          onClick={e => e.stopPropagation()}
        >
          <button
            onClick={() => setPromptModalOpen(false)}
            className="absolute top-4 right-4 p-1.5 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <XIcon className="h-4 w-4" />
          </button>
          <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: "#2e2d29" }}>
            Practice prompt
          </p>
          <p className="text-sm leading-relaxed" style={{ color: "#0F1B2D" }}>
            {session.promptText}
          </p>
        </div>
      </div>
    )}
    </>
  );
}

function DimensionCard({
  score,
  isExpanded,
  onToggle,
}: {
  score: DimensionScore;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const colors = getTierColors(score.tier);
  const label = DIMENSION_LABELS[score.dimensionKey] || score.dimensionKey;
  const isHighScoring = score.score >= 6.5;
  const isVeryLow = score.score <= 2.0;

  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      <button
        className="flex items-center justify-between w-full px-4 py-3.5 text-left hover:bg-gray-50/40 transition-colors"
        onClick={onToggle}
        aria-expanded={isExpanded}
      >
        <span className="text-sm font-medium text-[#0F1B2D]">{label}</span>
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="text-sm font-bold tabular-nums" style={{ color: colors.hex }}>
            {score.score}
          </span>
          <ChevronDownIcon
            className={`h-4 w-4 text-gray-300 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-gray-100 px-4 pb-4 pt-3">
          <div className="space-y-2.5">
            {/* Strength: shown for all except very-low scoring dims */}
            {score.strengthText && !isVeryLow && (
              <p className="text-sm text-gray-700 leading-relaxed">{score.strengthText}</p>
            )}
            {/* Gap / development observation: always shown */}
            {score.gapText && (
              <p className="text-sm text-gray-600 leading-relaxed">{score.gapText}</p>
            )}
            {/* Action: hidden for Strong and Distinguished dimensions */}
            {score.nextStepText && !isHighScoring && (
              <div className="mt-3 rounded-md bg-[#FBF7F2] border border-[#F0953E]/20 px-3.5 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#C84A18] mb-1.5">
                  Try in your next recording
                </p>
                <p className="text-sm text-gray-700 leading-relaxed">{score.nextStepText}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function CollapsibleMetrics({ session }: { session: SessionDetail }) {
  const [isOpen, setIsOpen] = useState(false);

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

  function getRaw<T>(dim: typeof paceDim, key: string, type: string): T | null {
    const val = dim?.rawMetrics ? (dim.rawMetrics as Record<string, unknown>)[key] : undefined;
    return typeof val === type ? (val as T) : null;
  }

  const pitchVariationScore = getRaw<number>(pitchSource, "pitchVariationScore", "number");
  const breathingScore = getRaw<number>(breathSource, "breathingScore", "number");
  const contextLabel = getRaw<string>(paceDim, "contextLabel", "string");
  const idealWpmMin = getRaw<number>(paceDim, "idealWpmMin", "number");
  const idealWpmMax = getRaw<number>(paceDim, "idealWpmMax", "number");

  type Status = "good" | "warn" | "poor";

  const STATUS_COLORS: Record<Status, string> = {
    good: "text-[#C84A18]",
    warn: "text-[#F0953E]",
    poor: "text-[#78736A]",
  };

  const wpmStatus = (v: number): Status => {
    if (idealWpmMin !== null && idealWpmMax !== null) {
      if (v >= idealWpmMin && v <= idealWpmMax) return "good";
      return Math.abs(v < idealWpmMin ? idealWpmMin - v : v - idealWpmMax) <= 20 ? "warn" : "poor";
    }
    if (v >= 120 && v <= 160) return "good";
    return (v >= 100 && v < 120) || (v > 160 && v <= 185) ? "warn" : "poor";
  };

  const score5Status = (v: number): Status => (v >= 4 ? "good" : v === 3 ? "warn" : "poor");

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

  const metrics: {
    label: string;
    value: string;
    benchmark: string;
    status: Status;
    note?: string;
  }[] = [];

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

  if (metrics.length === 0) return null;

  return (
    <div className="mt-4 rounded-xl border border-gray-200 bg-white overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full px-5 py-4 text-left"
      >
        <div>
          <p className="text-sm font-semibold text-[#0F1B2D]">Session metrics</p>
          <p className="text-xs text-gray-400 mt-0.5">Pace, pitch, breath, vocabulary</p>
        </div>
        <ChevronDownIcon
          className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>
      {isOpen && (
        <div className="border-t border-gray-100 px-5 pb-5">
          <div className="divide-y divide-gray-100 mt-1">
            {metrics.map(m => (
              <div key={m.label} className="py-3 first:pt-2 last:pb-0">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm font-medium text-gray-800 shrink-0">{m.label}</p>
                  <p className={`text-sm font-semibold ${STATUS_COLORS[m.status]} text-right`}>
                    {m.value}
                  </p>
                </div>
                <p className="text-xs text-gray-400">Benchmark: {m.benchmark}</p>
                {m.note && <p className="text-xs text-gray-400">{m.note}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CollapsibleTranscript({ session }: { session: SessionDetail }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="mt-4 rounded-xl border border-gray-200 bg-white overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full px-5 py-4 text-left"
      >
        <div>
          <p className="text-sm font-semibold text-[#0F1B2D]">Your transcript</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {session.transcript ? "Full session transcript" : "No transcript available"}
          </p>
        </div>
        <ChevronDownIcon
          className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>
      {isOpen && (
        <div className="border-t border-gray-100 px-5 pb-5">
          {session.transcript ? (
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap mt-4">
              {session.transcript}
            </p>
          ) : (
            <p className="text-sm text-gray-400 mt-4">
              No transcript was generated for this session. Feedback is based on audio signal analysis only.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
