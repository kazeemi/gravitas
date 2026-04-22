import { jsPDF } from "jspdf";
import type { SessionDetail } from "./api";
import { DIMENSION_LABELS, PILLARS, getTierColors } from "./tier-colors";
import { format } from "date-fns";

interface OverallFeedback {
  strengths?: string;
  improvements?: string;
  nextStep?: string;
}

function parseOverallFeedback(raw: string | null): OverallFeedback | null {
  if (!raw) return null;
  try { return JSON.parse(raw) as OverallFeedback; } catch { return { strengths: raw }; }
}

const BRAND = "#C84A18";
const GRAY_DARK = "#1a1a1a";
const GRAY_MED = "#555555";
const GRAY_LIGHT = "#888888";

function wrapText(doc: jsPDF, text: string, x: number, y: number, maxWidth: number, lineHeight: number): number {
  const lines = doc.splitTextToSize(text, maxWidth);
  doc.text(lines, x, y);
  return y + lines.length * lineHeight;
}

function sectionHeader(doc: jsPDF, label: string, y: number, pageW: number, margin: number): number {
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(BRAND);
  doc.text(label.toUpperCase(), margin, y);
  doc.setDrawColor(BRAND);
  doc.setLineWidth(0.3);
  doc.line(margin + doc.getTextWidth(label.toUpperCase()) + 3, y - 0.5, pageW - margin, y - 0.5);
  return y + 7;
}

function checkPage(doc: jsPDF, y: number, pageH: number, margin: number, needed = 20): number {
  if (y + needed > pageH - margin) {
    doc.addPage();
    return margin + 10;
  }
  return y;
}

export function downloadSessionPdf(session: SessionDetail, userName: string | null) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 18;
  const contentW = pageW - margin * 2;
  const lineH = 5.5;
  let y = margin;

  // ── Header bar ──────────────────────────────────────────────────────────────
  doc.setFillColor(BRAND);
  doc.rect(0, 0, pageW, 18, "F");
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor("#ffffff");
  doc.text("GRAVITAS", margin, 12);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Executive Presence Report", margin + 36, 12);
  y = 28;

  // ── Session meta ─────────────────────────────────────────────────────────────
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(GRAY_DARK);
  const nameLabel = userName ? `Prepared for: ${userName}` : "Executive Presence Report";
  doc.text(nameLabel, margin, y);
  y += 6;

  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(GRAY_MED);
  const dateStr = format(new Date(session.createdAt), "MMMM d, yyyy");
  const dur = session.durationSeconds
    ? `${Math.floor(session.durationSeconds / 60)}m ${session.durationSeconds % 60}s`
    : null;
  const meta = [
    `Date: ${dateStr}`,
    `Mode: ${session.mode.charAt(0).toUpperCase() + session.mode.slice(1)}`,
    dur ? `Duration: ${dur}` : null,
  ].filter(Boolean).join("   ·   ");
  doc.text(meta, margin, y);
  y += 5;

  if (session.promptText) {
    doc.setFont("helvetica", "italic");
    doc.setTextColor(GRAY_MED);
    y = wrapText(doc, `Prompt: "${session.promptText}"`, margin, y, contentW, 5);
    y += 2;
  }

  // ── Overall score ────────────────────────────────────────────────────────────
  if (session.compositeScore && session.compositeTier) {
    const score = parseFloat(session.compositeScore);
    const { hex } = getTierColors(session.compositeTier);
    y += 2;
    doc.setFillColor(245, 245, 245);
    doc.roundedRect(margin, y, contentW, 18, 2, 2, "F");
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(hex);
    doc.text(score.toFixed(1), margin + 6, y + 13);
    const scoreW = doc.getTextWidth(score.toFixed(1));
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(GRAY_DARK);
    doc.text(session.compositeTier, margin + 6 + scoreW + 4, y + 8);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(GRAY_MED);
    doc.text("Overall Composite Score  ·  10-point scale", margin + 6 + scoreW + 4, y + 14);
    y += 24;
  } else {
    y += 4;
  }

  // ── Overall coaching summary ──────────────────────────────────────────────────
  const overallFeedback = parseOverallFeedback(session.overallFeedback ?? null);
  if (overallFeedback) {
    y = sectionHeader(doc, "Overall Coaching Summary", y, pageW, margin);

    const feedbackItems: { label: string; text: string; color: string }[] = [];
    if (overallFeedback.strengths) feedbackItems.push({ label: "Strengths", text: overallFeedback.strengths, color: "#2d6a2d" });
    if (overallFeedback.improvements) feedbackItems.push({ label: "Areas to Improve", text: overallFeedback.improvements, color: "#8a5c00" });
    if (overallFeedback.nextStep) feedbackItems.push({ label: "Priority Next Step", text: overallFeedback.nextStep, color: "#1a4a8a" });

    for (const item of feedbackItems) {
      y = checkPage(doc, y, pageH, margin);
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(item.color);
      doc.text(item.label, margin, y);
      y += 4.5;
      doc.setFont("helvetica", "normal");
      doc.setTextColor(GRAY_DARK);
      y = wrapText(doc, item.text, margin, y, contentW, lineH);
      y += 4;
    }
  }

  // ── Dimension scores by pillar ───────────────────────────────────────────────
  if (session.dimensionScores.length > 0) {
    y = checkPage(doc, y, pageH, margin, 30);
    y = sectionHeader(doc, "Dimension Scores", y, pageW, margin);

    const sortedDims = [...session.dimensionScores].sort((a, b) => {
      const allDims = PILLARS.flatMap(p => p.dimensions);
      return allDims.indexOf(a.dimensionKey) - allDims.indexOf(b.dimensionKey);
    });

    const dimsByPillar = PILLARS.map(pillar => ({
      pillar,
      dims: sortedDims.filter(d => pillar.dimensions.includes(d.dimensionKey)),
    })).filter(g => g.dims.length > 0);

    for (const { pillar, dims } of dimsByPillar) {
      y = checkPage(doc, y, pageH, margin, 20);

      // Pillar sub-header
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(GRAY_LIGHT);
      doc.text(pillar.name.toUpperCase(), margin, y);
      y += 5;

      for (const dim of dims) {
        y = checkPage(doc, y, pageH, margin, 18);
        const label = DIMENSION_LABELS[dim.dimensionKey] || dim.dimensionKey;
        const { hex } = getTierColors(dim.tier);

        // Score row
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(GRAY_DARK);
        doc.text(label, margin, y);
        doc.setTextColor(hex);
        const scoreStr = `${dim.score}/10 — ${dim.tier}`;
        doc.text(scoreStr, pageW - margin - doc.getTextWidth(scoreStr), y);
        y += 4;

        // Score bar
        const barW = contentW;
        doc.setFillColor(235, 235, 235);
        doc.roundedRect(margin, y, barW, 2, 0.5, 0.5, "F");
        const filled = (dim.score / 10) * barW;
        const rgb = hexToRgb(hex);
        doc.setFillColor(rgb.r, rgb.g, rgb.b);
        doc.roundedRect(margin, y, filled, 2, 0.5, 0.5, "F");
        y += 5;

        // Strength, gap, next step
        const subItems: { dot: string; text: string; color: [number,number,number] }[] = [];
        if (dim.strengthText) subItems.push({ dot: "●", text: dim.strengthText, color: [45, 106, 45] });
        if (dim.gapText) subItems.push({ dot: "●", text: dim.gapText, color: [138, 92, 0] });
        if (dim.nextStepText) subItems.push({ dot: "●", text: dim.nextStepText, color: [26, 74, 138] });

        for (const sub of subItems) {
          y = checkPage(doc, y, pageH, margin, 10);
          doc.setFontSize(7.5);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(...sub.color);
          doc.text(sub.dot, margin + 1, y);
          doc.setTextColor(GRAY_DARK);
          y = wrapText(doc, sub.text, margin + 5, y, contentW - 5, 4.5);
          y += 1;
        }
        y += 4;
      }
    }
  }

  // ── Session metrics ───────────────────────────────────────────────────────────
  const metricsRows = buildMetricsRows(session);
  if (metricsRows.length > 0) {
    y = checkPage(doc, y, pageH, margin, 30);
    y = sectionHeader(doc, "Session Metrics", y, pageW, margin);

    for (const row of metricsRows) {
      y = checkPage(doc, y, pageH, margin, 12);
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(GRAY_DARK);
      doc.text(row.label, margin, y);
      doc.setTextColor(row.statusColor);
      const valW = doc.getTextWidth(row.value);
      doc.text(row.value, pageW - margin - valW, y);
      y += 4;
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(GRAY_LIGHT);
      doc.text(`Benchmark: ${row.benchmark}`, margin, y);
      if (row.note) {
        y += 3.5;
        doc.text(row.note, margin, y);
      }
      y += 5;
    }
  }

  // ── Transcript ────────────────────────────────────────────────────────────────
  if (session.transcript) {
    y = checkPage(doc, y, pageH, margin, 30);
    y = sectionHeader(doc, "Session Transcript", y, pageW, margin);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(GRAY_DARK);
    y = wrapText(doc, session.transcript, margin, y, contentW, 4.8);
    y += 4;
  }

  // ── Footer on every page ──────────────────────────────────────────────────────
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(GRAY_LIGHT);
    doc.setFont("helvetica", "normal");
    doc.text("Gravitas — Executive Presence AI Coach", margin, pageH - 8);
    doc.text(`Page ${i} of ${totalPages}`, pageW - margin - doc.getTextWidth(`Page ${i} of ${totalPages}`), pageH - 8);
  }

  // ── Save ──────────────────────────────────────────────────────────────────────
  const dateSlug = format(new Date(session.createdAt), "yyyy-MM-dd");
  doc.save(`gravitas-report-${dateSlug}.pdf`);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace("#", "");
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

interface MetricRow {
  label: string;
  value: string;
  benchmark: string;
  note?: string;
  statusColor: string;
}

const GOOD_COLOR = "#C84A18";
const WARN_COLOR = "#F0953E";
const POOR_COLOR = "#78736A";

function buildMetricsRows(session: SessionDetail): MetricRow[] {
  const duration = session.durationSeconds ?? 0;
  const transcript = session.transcript ?? "";
  const words = transcript.trim() ? transcript.trim().split(/\s+/).filter(Boolean) : [];
  const wordCount = words.length > 0 ? words.length : null;
  const wpm = wordCount !== null && duration > 0 ? Math.round((wordCount / duration) * 60) : null;
  const fillerCount = transcript
    ? (transcript.match(/\b(um+|uh+|like|you know|so,?|basically|literally|actually|right\?|i mean|kind of|sort of|you see)\b/gi) || []).length
    : null;
  const durationMinutes = duration / 60;
  const fillerRate = fillerCount !== null && durationMinutes > 0 ? parseFloat((fillerCount / durationMinutes).toFixed(1)) : null;
  const silences = session.silenceEvents ?? 0;
  const lexicalVariance = wordCount !== null && wordCount > 0
    ? Math.round((new Set(words.map(w => w.toLowerCase().replace(/[^a-z]/g, ""))).size / wordCount) * 100) : null;

  const paceDim = session.dimensionScores?.find(d => d.dimensionKey === "pace");
  const intonationDim = session.dimensionScores?.find(d => d.dimensionKey === "intonation");
  const breathDim = session.dimensionScores?.find(d => d.dimensionKey === "breath_control");
  const legacyPaceRhythm = session.dimensionScores?.find(d => d.dimensionKey === "pace_rhythm");
  const legacyVocalClarity = session.dimensionScores?.find(d => d.dimensionKey === "vocal_clarity");

  const pitchSource = intonationDim ?? legacyPaceRhythm;
  const breathSource = breathDim ?? legacyVocalClarity;

  const rm = (d: typeof paceDim) => d?.rawMetrics as Record<string, unknown> | undefined;
  const pitchVariationScore = typeof rm(pitchSource)?.pitchVariationScore === "number" ? rm(pitchSource)!.pitchVariationScore as number : null;
  const breathingScore = typeof rm(breathSource)?.breathingScore === "number" ? rm(breathSource)!.breathingScore as number : null;
  const breathingObservation = typeof rm(breathSource)?.breathingObservation === "string" ? rm(breathSource)!.breathingObservation as string : null;
  const idealWpmMin = typeof rm(paceDim)?.idealWpmMin === "number" ? rm(paceDim)!.idealWpmMin as number : null;
  const idealWpmMax = typeof rm(paceDim)?.idealWpmMax === "number" ? rm(paceDim)!.idealWpmMax as number : null;
  const contextLabel = typeof rm(paceDim)?.contextLabel === "string" ? rm(paceDim)!.contextLabel as string : null;

  const PITCH_LABELS: Record<number, string> = {
    1: "Completely flat / monotone", 2: "Minimal pitch variation", 3: "Some variation — inconsistent",
    4: "Good natural variation", 5: "Excellent dynamic range",
  };
  const BREATH_LABELS: Record<number, string> = {
    1: "Severe breathlessness / audible gasping", 2: "Noticeably shallow or strained",
    3: "Adequate — some strain detectable", 4: "Mostly controlled and relaxed", 5: "Excellent — relaxed, effortless control",
  };

  const wpmStat = (v: number) => {
    if (idealWpmMin !== null && idealWpmMax !== null) {
      if (v >= idealWpmMin && v <= idealWpmMax) return GOOD_COLOR;
      return Math.abs(v - (idealWpmMin + idealWpmMax) / 2) <= 20 ? WARN_COLOR : POOR_COLOR;
    }
    return v >= 120 && v <= 160 ? GOOD_COLOR : (v >= 100 && v <= 185) ? WARN_COLOR : POOR_COLOR;
  };

  const rows: MetricRow[] = [];

  if (duration > 0) {
    const m = Math.floor(duration / 60); const s = duration % 60;
    rows.push({ label: "Duration", value: `${m}m ${s}s`, benchmark: "≥ 1 minute", statusColor: duration >= 60 ? GOOD_COLOR : POOR_COLOR });
  }
  if (wpm !== null) {
    const benchmarkLabel = idealWpmMin !== null && idealWpmMax !== null
      ? `${idealWpmMin}–${idealWpmMax} WPM${contextLabel ? ` (${contextLabel})` : ""}` : "120–160 WPM";
    rows.push({
      label: "Speaking pace", value: `${wpm} WPM`, benchmark: benchmarkLabel, statusColor: wpmStat(wpm),
      note: idealWpmMin !== null && idealWpmMax !== null
        ? (wpm < idealWpmMin ? "Below ideal for this context — try increasing your pace" : wpm > idealWpmMax ? "Above ideal for this context — consider slowing down" : "Within the ideal range for this context")
        : (wpm < 120 ? "Too slow" : wpm > 160 ? "Too fast" : "Within ideal range"),
    });
  }
  if (pitchVariationScore !== null) {
    rows.push({ label: "Pitch variation", value: `${pitchVariationScore}/5 — ${PITCH_LABELS[pitchVariationScore] ?? ""}`, benchmark: "4–5 (natural expressive variation)", statusColor: pitchVariationScore >= 4 ? GOOD_COLOR : pitchVariationScore === 3 ? WARN_COLOR : POOR_COLOR });
  }
  if (breathingScore !== null) {
    rows.push({ label: "Breath control", value: `${breathingScore}/5 — ${BREATH_LABELS[breathingScore] ?? ""}`, benchmark: "4–5 (controlled, relaxed breath support)", statusColor: breathingScore >= 4 ? GOOD_COLOR : breathingScore === 3 ? WARN_COLOR : POOR_COLOR, note: breathingObservation ?? undefined });
  }
  if (fillerRate !== null) {
    rows.push({ label: "Filler word rate", value: fillerCount === 0 ? "None detected" : `${fillerRate}/min (${fillerCount} total)`, benchmark: "< 1 per minute", statusColor: fillerRate < 1 ? GOOD_COLOR : fillerRate < 3 ? WARN_COLOR : POOR_COLOR });
  }
  if (lexicalVariance !== null && wordCount !== null && wordCount >= 50) {
    rows.push({ label: "Vocabulary variety", value: `${lexicalVariance}% unique words`, benchmark: "> 70% (rich, non-repetitive language)", statusColor: lexicalVariance > 70 ? GOOD_COLOR : lexicalVariance >= 55 ? WARN_COLOR : POOR_COLOR });
  }
  rows.push({ label: "Long pauses (4s+)", value: silences === 0 ? "None" : silences.toString(), benchmark: "0 unplanned pauses", statusColor: silences === 0 ? GOOD_COLOR : silences <= 2 ? WARN_COLOR : POOR_COLOR });

  return rows;
}
