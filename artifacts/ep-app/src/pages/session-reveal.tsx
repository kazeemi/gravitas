import { useEffect, useRef, useState } from "react";
import { useParams, useLocation } from "wouter";
import { api, type SessionDetail } from "@/lib/api";
import { getTierColors, DIMENSION_LABELS, PILLARS, DIMENSION_DISPLAY_ORDER } from "@/lib/tier-colors";
import { ArrowRightIcon, ChevronDownIcon, ChevronUpIcon, MicIcon, VideoIcon } from "lucide-react";
import { format } from "date-fns";

// ── Shared utilities ───────────────────────────────────────────────────────

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
  innerWorkEscalation?: string;
}

function parseOverallFeedback(raw: string | null | undefined): OverallFeedback | null {
  if (!raw) return null;
  try { return JSON.parse(raw) as OverallFeedback; } catch { return { strengths: raw }; }
}

function sentencesToBullets(text: string): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+/g);
  if (sentences && sentences.length > 1) return sentences.map(s => s.trim()).filter(Boolean).slice(0, 3);
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

function getSummaryLabels(tier: string) {
  switch (tier) {
    case "Distinguished": return { strengths: "What makes you exceptional", improvements: "What would make you even greater" };
    case "Strong": return { strengths: "What makes you great", improvements: "What would make you even greater" };
    case "Developing": return { strengths: "What's working well", improvements: "What's worth working on" };
    default: return { strengths: "What's already there", improvements: "What needs your attention most" };
  }
}

function scoreToTier(score: number): string {
  if (score < 4) return "Needs Focus";
  if (score < 6.5) return "Developing";
  if (score < 8.5) return "Strong";
  return "Distinguished";
}

// ── Slide types ────────────────────────────────────────────────────────────

type Slide = "score" | "strengths" | "improvements" | "focus" | "pillars";
const SLIDES: Slide[] = ["score", "strengths", "improvements", "focus", "pillars"];

// ── Main component ─────────────────────────────────────────────────────────

export default function SessionRevealPage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();

  const [session, setSession] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Slide navigation
  const [slideIndex, setSlideIndex] = useState(0);
  const [slideIn, setSlideIn] = useState(true);

  // Per-slide animation state
  const [animatedScore, setAnimatedScore] = useState(0);
  const [messageVisible, setMessageVisible] = useState(false);
  const [visibleBullets, setVisibleBullets] = useState(0);
  const [focusVisible, setFocusVisible] = useState(false);
  const [pillarsRevealed, setPillarsRevealed] = useState(0);
  const [selectedPillarIndex, setSelectedPillarIndex] = useState(0);
  const [expandedDimKey, setExpandedDimKey] = useState<string | null>(null);

  const rafRef = useRef<number | null>(null);
  const timersRef = useRef<number[]>([]);

  // ── Load data ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!id) return;
    api.sessions.get(id)
      .then(setSession)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  // ── Slide entrance animations ────────────────────────────────────────────

  useEffect(() => {
    if (!session || !slideIn) return;
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];

    const slide = SLIDES[slideIndex];
    const fb = parseOverallFeedback(session.overallFeedback);

    if (slide === "score") {
      const target = session.compositeScore ? parseFloat(session.compositeScore) : 0;
      const startTime = performance.now();
      const duration = 1500;
      const animate = (now: number) => {
        const t = Math.min((now - startTime) / duration, 1);
        const eased = 1 - Math.pow(1 - t, 3);
        setAnimatedScore(parseFloat((eased * target).toFixed(1)));
        if (t < 1) rafRef.current = requestAnimationFrame(animate);
        else setAnimatedScore(target);
      };
      rafRef.current = requestAnimationFrame(animate);
      timersRef.current.push(window.setTimeout(() => setMessageVisible(true), 900));
    }

    if (slide === "strengths") {
      const bullets = fb ? getStrengthBullets(fb) : [];
      const count = Math.max(bullets.length, 1);
      for (let i = 0; i < count; i++) {
        timersRef.current.push(window.setTimeout(() => setVisibleBullets(i + 1), 250 + i * 480));
      }
    }

    if (slide === "improvements") {
      const bullets = fb ? getImprovementBullets(fb) : [];
      const count = Math.max(bullets.length, 1);
      for (let i = 0; i < count; i++) {
        timersRef.current.push(window.setTimeout(() => setVisibleBullets(i + 1), 250 + i * 480));
      }
    }

    if (slide === "focus") {
      timersRef.current.push(window.setTimeout(() => setFocusVisible(true), 250));
    }

    if (slide === "pillars") {
      const sortedDims = [...session.dimensionScores].sort((a, b) => {
        const ai = DIMENSION_DISPLAY_ORDER.indexOf(a.dimensionKey);
        const bi = DIMENSION_DISPLAY_ORDER.indexOf(b.dimensionKey);
        return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
      });
      const groups = PILLARS
        .map(p => ({ pillar: p, dims: sortedDims.filter(d => p.dimensions.includes(d.dimensionKey)) }))
        .filter(g => g.dims.length > 0);
      for (let i = 0; i < groups.length; i++) {
        timersRef.current.push(
          window.setTimeout(() => {
            setPillarsRevealed(i + 1);
            setSelectedPillarIndex(i);
          }, i * 620)
        );
      }
    }

    return () => {
      timersRef.current.forEach(clearTimeout);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [slideIndex, slideIn, session]);

  // ── Navigation ───────────────────────────────────────────────────────────

  const goNext = () => {
    if (slideIndex >= SLIDES.length - 1) return;
    setSlideIn(false);
    window.setTimeout(() => {
      setSlideIndex(i => i + 1);
      setMessageVisible(false);
      setVisibleBullets(0);
      setFocusVisible(false);
      setPillarsRevealed(0);
      setSelectedPillarIndex(0);
      setExpandedDimKey(null);
      setAnimatedScore(0);
      setSlideIn(true);
    }, 240);
  };

  const goPrev = () => {
    if (slideIndex <= 0) return;
    setSlideIn(false);
    window.setTimeout(() => {
      setSlideIndex(i => i - 1);
      setMessageVisible(false);
      setVisibleBullets(0);
      setFocusVisible(false);
      setPillarsRevealed(0);
      setSelectedPillarIndex(0);
      setExpandedDimKey(null);
      setAnimatedScore(0);
      setSlideIn(true);
    }, 240);
  };

  // ── Loading / error ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <div
        className="-mx-4 -my-6 md:-mx-8 md:-my-8 flex items-center justify-center"
        style={{ minHeight: "calc(100dvh - 56px)", background: "#0F1B2D" }}
      >
        <div className="h-7 w-7 rounded-full border-2 animate-spin"
          style={{ borderColor: "rgba(240,149,62,0.2)", borderTopColor: "#F0953E" }} />
      </div>
    );
  }

  if (error || !session) {
    return (
      <div
        className="-mx-4 -my-6 md:-mx-8 md:-my-8 flex flex-col items-center justify-center gap-4"
        style={{ minHeight: "calc(100dvh - 56px)", background: "#0F1B2D" }}
      >
        <p className="text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>{error || "Session not found"}</p>
        <button
          onClick={() => setLocation("/dashboard")}
          className="px-4 py-2 rounded-lg text-xs"
          style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.6)" }}
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  // ── Derived data ─────────────────────────────────────────────────────────

  const fb = parseOverallFeedback(session.overallFeedback);
  const score = session.compositeScore ? parseFloat(session.compositeScore) : null;
  const tier = session.compositeTier || "Developing";
  const tierColors = getTierColors(tier);
  const labels = getSummaryLabels(tier);
  const isNeedsFocus = tier === "Needs Focus";
  const strengthBullets = fb ? getStrengthBullets(fb) : [];
  const improvementBullets = fb ? getImprovementBullets(fb) : [];
  const priorityAction = fb?.priorityAction || (!isNeedsFocus ? fb?.nextStep : null) || null;
  const priorityActions = fb?.priorityActions || [];

  const sortedDimensions = [...session.dimensionScores].sort((a, b) => {
    const ai = DIMENSION_DISPLAY_ORDER.indexOf(a.dimensionKey);
    const bi = DIMENSION_DISPLAY_ORDER.indexOf(b.dimensionKey);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });

  const dimensionsByPillar = PILLARS
    .map(p => ({
      pillar: p,
      dimensions: sortedDimensions.filter(d => p.dimensions.includes(d.dimensionKey)),
    }))
    .filter(g => g.dimensions.length > 0);

  const isLastSlide = slideIndex === SLIDES.length - 1;
  const currentSlide = SLIDES[slideIndex];
  const noScore = score === null || session.dimensionScores.length === 0;

  const activePillar = dimensionsByPillar[selectedPillarIndex];

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div
      className="-mx-4 -my-6 md:-mx-8 md:-my-8 flex flex-col"
      style={{ minHeight: "calc(100dvh - 56px)", background: "#0F1B2D" }}
    >
      {/* Instagram-style progress bars */}
      <div className="flex gap-1.5 px-6 pt-5">
        {SLIDES.map((_, i) => (
          <div
            key={i}
            className="flex-1 rounded-full overflow-hidden"
            style={{ height: "2px", background: "rgba(255,255,255,0.1)" }}
          >
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ background: "#F0953E", width: i <= slideIndex ? "100%" : "0%" }}
            />
          </div>
        ))}
      </div>

      {/* Slide area */}
      <div
        className="flex-1 flex flex-col max-w-xl mx-auto w-full px-6 pt-7 pb-6"
        style={{
          opacity: slideIn ? 1 : 0,
          transform: slideIn ? "none" : "translateY(10px)",
          transition: "opacity 0.24s ease, transform 0.24s ease",
        }}
      >

        {/* ── SCORE slide ── */}
        {currentSlide === "score" && (
          <div className="flex flex-col gap-7 flex-1">
            <div className="flex items-center gap-2" style={{ color: "rgba(255,255,255,0.28)" }}>
              {session.mode === "audio"
                ? <MicIcon className="h-3.5 w-3.5" />
                : <VideoIcon className="h-3.5 w-3.5" />}
              <span className="text-xs">{format(new Date(session.createdAt), "MMM d, yyyy")}</span>
              {session.durationSeconds && (
                <>
                  <span className="text-xs">·</span>
                  <span className="text-xs">
                    {Math.floor(session.durationSeconds / 60)}m {session.durationSeconds % 60}s
                  </span>
                </>
              )}
            </div>

            {noScore ? (
              <div className="space-y-2">
                <p className="text-5xl font-bold" style={{ color: "rgba(255,255,255,0.3)" }}>—</p>
                <p className="text-sm uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.3)" }}>
                  Not scored
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <p
                  className="font-bold leading-none tabular-nums"
                  style={{ fontSize: "clamp(4rem, 16vw, 7rem)", color: tierColors.hex }}
                >
                  {animatedScore.toFixed(1)}
                </p>
                <p
                  className="text-sm font-bold uppercase tracking-[0.22em]"
                  style={{ color: tierColors.hex }}
                >
                  {tier}
                </p>
              </div>
            )}

            <div style={{ height: "1px", background: "rgba(255,255,255,0.07)" }} />

            <div
              style={{
                opacity: messageVisible ? 1 : 0,
                transform: messageVisible ? "none" : "translateY(8px)",
                transition: "opacity 0.5s ease, transform 0.5s ease",
              }}
            >
              {fb?.motivationalMessage ? (
                <p
                  className="text-base leading-[1.75]"
                  style={{ color: "rgba(255,255,255,0.72)", fontStyle: "italic" }}
                >
                  {fb.motivationalMessage}
                </p>
              ) : (
                <p className="text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>
                  Your session is ready to review.
                </p>
              )}
            </div>

            {session.promptText && messageVisible && (
              <div
                className="rounded-xl px-4 py-3.5"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  opacity: messageVisible ? 1 : 0,
                  transition: "opacity 0.5s ease 0.25s",
                }}
              >
                <p
                  className="text-xs font-semibold uppercase tracking-widest mb-1.5"
                  style={{ color: "#F0953E" }}
                >
                  Your prompt
                </p>
                <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.55)" }}>
                  {session.promptText}
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── STRENGTHS slide ── */}
        {currentSlide === "strengths" && (
          <div className="flex flex-col gap-8 flex-1">
            <div>
              <p
                className="text-base font-bold uppercase tracking-widest"
                style={{ color: "#F0953E" }}
              >
                {labels.strengths}
              </p>
              <div style={{ height: "1px", background: "rgba(240,149,62,0.2)", marginTop: "14px" }} />
            </div>

            {fb?.noStrengthsLine ? (
              <p
                className="text-sm leading-relaxed"
                style={{
                  color: "rgba(255,255,255,0.5)",
                  fontStyle: "italic",
                  opacity: visibleBullets > 0 ? 1 : 0,
                  transform: visibleBullets > 0 ? "none" : "translateY(8px)",
                  transition: "opacity 0.4s ease, transform 0.4s ease",
                }}
              >
                {fb.noStrengthsLine}
              </p>
            ) : strengthBullets.length > 0 ? (
              <ul className="space-y-6">
                {strengthBullets.map((bullet, i) => (
                  <li
                    key={i}
                    className="flex gap-3.5"
                    style={{
                      opacity: visibleBullets > i ? 1 : 0,
                      transform: visibleBullets > i ? "none" : "translateY(10px)",
                      transition: "opacity 0.4s ease, transform 0.4s ease",
                    }}
                  >
                    <span
                      className="flex-shrink-0 mt-2 rounded-full"
                      style={{ width: "5px", height: "5px", background: "#F0953E" }}
                    />
                    <span className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.82)" }}>
                      {bullet}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p
                className="text-sm"
                style={{
                  color: "rgba(255,255,255,0.35)",
                  fontStyle: "italic",
                  opacity: visibleBullets > 0 ? 1 : 0,
                  transition: "opacity 0.4s ease",
                }}
              >
                No specific strengths identified for this session.
              </p>
            )}
          </div>
        )}

        {/* ── IMPROVEMENTS slide ── */}
        {currentSlide === "improvements" && (
          <div className="flex flex-col gap-8 flex-1">
            <div>
              <p
                className="text-base font-bold uppercase tracking-widest"
                style={{ color: "#C84A18" }}
              >
                {labels.improvements}
              </p>
              <div style={{ height: "1px", background: "rgba(200,74,24,0.25)", marginTop: "14px" }} />
            </div>

            {improvementBullets.length > 0 ? (
              <ul className="space-y-6">
                {improvementBullets.map((bullet, i) => (
                  <li
                    key={i}
                    className="flex gap-3.5"
                    style={{
                      opacity: visibleBullets > i ? 1 : 0,
                      transform: visibleBullets > i ? "none" : "translateY(10px)",
                      transition: "opacity 0.4s ease, transform 0.4s ease",
                    }}
                  >
                    <span
                      className="flex-shrink-0 mt-2 rounded-full"
                      style={{ width: "5px", height: "5px", background: "#C84A18" }}
                    />
                    <span className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.82)" }}>
                      {bullet}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p
                className="text-sm"
                style={{
                  color: "rgba(255,255,255,0.35)",
                  fontStyle: "italic",
                  opacity: visibleBullets > 0 ? 1 : 0,
                  transition: "opacity 0.4s ease",
                }}
              >
                No specific development areas identified.
              </p>
            )}
          </div>
        )}

        {/* ── FOCUS slide ── */}
        {currentSlide === "focus" && (
          <div className="flex flex-col gap-8 flex-1">
            <div>
              <p
                className="text-base font-bold uppercase tracking-widest"
                style={{ color: "#F0953E" }}
              >
                Focus for your next recording
              </p>
              <div style={{ height: "1px", background: "rgba(240,149,62,0.2)", marginTop: "14px" }} />
            </div>

            <div
              style={{
                opacity: focusVisible ? 1 : 0,
                transform: focusVisible ? "none" : "translateY(10px)",
                transition: "opacity 0.45s ease, transform 0.45s ease",
              }}
            >
              {isNeedsFocus && priorityActions.length > 0 ? (
                <div className="space-y-5">
                  {fb?.needsFocusPreamble && (
                    <p
                      className="text-sm leading-relaxed"
                      style={{ color: "rgba(255,255,255,0.45)", fontStyle: "italic" }}
                    >
                      {fb.needsFocusPreamble}
                    </p>
                  )}
                  <div className="space-y-5">
                    {priorityActions.map((action, i) => (
                      <div key={i} className="flex gap-3.5">
                        <span
                          className="flex-shrink-0 h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                          style={{ background: "rgba(240,149,62,0.14)", color: "#F0953E" }}
                        >
                          {i + 1}
                        </span>
                        <p
                          className="text-sm leading-relaxed pt-0.5"
                          style={{ color: "rgba(255,255,255,0.82)" }}
                        >
                          {action}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : priorityAction ? (
                <p className="text-base leading-[1.8]" style={{ color: "rgba(255,255,255,0.82)" }}>
                  {priorityAction}
                </p>
              ) : (
                <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)", fontStyle: "italic" }}>
                  Keep recording consistently — that is the most valuable next step.
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── PILLARS slide ── */}
        {currentSlide === "pillars" && (
          <div className="flex flex-col flex-1 overflow-hidden gap-5">

            {/* Slide heading */}
            <p
              className="text-base font-bold uppercase tracking-widest flex-shrink-0"
              style={{ color: "rgba(255,255,255,0.35)" }}
            >
              Your results
            </p>

            {/* Vertical pillar list — each animates in one at a time */}
            <div className="flex-1 overflow-y-auto space-y-6">
              {dimensionsByPillar.map(({ pillar, dimensions }, pi) => {
                const avgScore = dimensions.reduce((s, d) => s + d.score, 0) / dimensions.length;
                const pillarTier = scoreToTier(avgScore);
                const pillarColors = getTierColors(pillarTier);

                return (
                  <div
                    key={pillar.name}
                    style={{
                      opacity: pillarsRevealed > pi ? 1 : 0,
                      transform: pillarsRevealed > pi ? "none" : "translateY(14px)",
                      transition: "opacity 0.4s ease, transform 0.4s ease",
                    }}
                  >
                    {/* Pillar header */}
                    <div className="flex items-center justify-between mb-2">
                      <p
                        className="text-xs font-bold uppercase tracking-widest"
                        style={{ color: "rgba(255,255,255,0.5)" }}
                      >
                        {pillar.name}
                      </p>
                      <span
                        className="text-base font-bold tabular-nums"
                        style={{ color: pillarColors.hex }}
                      >
                        {avgScore.toFixed(1)}
                      </span>
                    </div>
                    <div className="mb-2" style={{ height: "1px", background: "rgba(255,255,255,0.07)" }} />

                    {/* Dimension rows */}
                    <div className="space-y-1.5">
                      {dimensions.map(d => {
                        const dColors = getTierColors(d.tier);
                        const isExpanded = expandedDimKey === d.dimensionKey;
                        const label = DIMENSION_LABELS[d.dimensionKey] || d.dimensionKey;

                        return (
                          <div key={d.dimensionKey}>
                            <button
                              className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-left transition-colors"
                              style={{
                                background: isExpanded ? "rgba(255,255,255,0.09)" : "rgba(255,255,255,0.04)",
                                border: isExpanded ? "1px solid rgba(255,255,255,0.1)" : "1px solid transparent",
                              }}
                              onClick={() => setExpandedDimKey(isExpanded ? null : d.dimensionKey)}
                            >
                              <span className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.8)" }}>
                                {label}
                              </span>
                              <div className="flex items-center gap-2.5 flex-shrink-0 ml-3">
                                <span className="text-sm font-bold tabular-nums" style={{ color: dColors.hex }}>
                                  {d.score.toFixed(1)}
                                </span>
                                <span
                                  className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded"
                                  style={{ background: `${dColors.hex}22`, color: dColors.hex }}
                                >
                                  {d.tier}
                                </span>
                                {isExpanded
                                  ? <ChevronUpIcon className="h-3.5 w-3.5" style={{ color: "rgba(255,255,255,0.3)" }} />
                                  : <ChevronDownIcon className="h-3.5 w-3.5" style={{ color: "rgba(255,255,255,0.3)" }} />}
                              </div>
                            </button>

                            {isExpanded && (
                              <div
                                className="mx-1 mb-1 px-5 py-5 rounded-xl space-y-4"
                                style={{
                                  background: "rgba(255,255,255,0.04)",
                                  border: "1px solid rgba(255,255,255,0.07)",
                                }}
                              >
                                {d.strengthText && (
                                  <div>
                                    <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "#F0953E" }}>
                                      What landed
                                    </p>
                                    <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.68)" }}>
                                      {d.strengthText}
                                    </p>
                                  </div>
                                )}
                                {d.gapText && (
                                  <div>
                                    <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "#C84A18" }}>
                                      What to sharpen
                                    </p>
                                    <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.68)" }}>
                                      {d.gapText}
                                    </p>
                                  </div>
                                )}
                                {d.nextStepText && (
                                  <div>
                                    <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "rgba(255,255,255,0.3)" }}>
                                      Next recording
                                    </p>
                                    <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.52)" }}>
                                      {d.nextStepText}
                                    </p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {dimensionsByPillar.length === 0 && (
                <p className="text-sm" style={{ color: "rgba(255,255,255,0.35)", fontStyle: "italic" }}>
                  No dimension scores available for this session.
                </p>
              )}
          </div>
        )}

        {/* ── Footer nav ── */}
        <div className="flex items-center justify-between pt-5 flex-shrink-0">
          {/* Left side: Back or Full report */}
          <div className="flex items-center gap-4">
            {slideIndex > 0 && (
              <button
                className="flex items-center gap-1 text-xs transition-colors"
                style={{ color: "rgba(255,255,255,0.4)" }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.7)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.4)"; }}
                onClick={goPrev}
              >
                <ArrowRightIcon className="h-3 w-3 rotate-180" />
                Back
              </button>
            )}
            <button
              className="flex items-center gap-1 text-xs transition-colors"
              style={{ color: "rgba(255,255,255,0.28)" }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.55)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.28)"; }}
              onClick={() => setLocation(`/sessions/${id}/full`)}
            >
              Full report
              <ArrowRightIcon className="h-3 w-3" />
            </button>
          </div>

          {!isLastSlide ? (
            <button
              className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-colors"
              style={{ background: "#F0953E", color: "#fff" }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "#C84A18"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "#F0953E"; }}
              onClick={goNext}
            >
              Next
              <ArrowRightIcon className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-colors"
              style={{ background: "#F0953E", color: "#fff" }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "#C84A18"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "#F0953E"; }}
              onClick={() =>
                setLocation(
                  session.promptText
                    ? `/record?prompt=${encodeURIComponent(session.promptText)}`
                    : "/record"
                )
              }
            >
              Record again
              <ArrowRightIcon className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
