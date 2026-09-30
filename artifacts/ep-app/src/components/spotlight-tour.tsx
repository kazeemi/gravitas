import { useEffect, useState, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";

export type TourStep = {
  /** CSS selector for the element to spotlight. Step is skipped if not found. */
  target: string;
  title?: string;
  body: string;
  /** Preferred placement of the tooltip relative to the target. Falls back to "bottom". */
  placement?: "top" | "bottom";
};

const PADDING = 8;

function useTargetRect(selector: string | null) {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useLayoutEffect(() => {
    if (!selector) {
      setRect(null);
      return;
    }
    const measure = () => {
      const el = document.querySelector(selector);
      setRect(el ? el.getBoundingClientRect() : null);
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [selector]);

  return rect;
}

export function SpotlightTour({
  steps,
  open,
  onClose,
}: {
  steps: TourStep[];
  open: boolean;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);

  // Find the next step whose target actually exists on the page, starting
  // from `index` — company dropdown / other conditional elements may not be
  // rendered for every user, so steps must be able to skip themselves.
  const resolvedIndex = (() => {
    for (let i = index; i < steps.length; i++) {
      if (document.querySelector(steps[i].target)) return i;
    }
    return -1;
  })();

  const current = resolvedIndex >= 0 ? steps[resolvedIndex] : null;
  const rect = useTargetRect(current?.target ?? null);

  useEffect(() => {
    if (open) setIndex(0);
  }, [open]);

  useEffect(() => {
    if (open && resolvedIndex === -1) {
      // Nothing left to highlight (e.g. all remaining targets missing) — end the tour.
      onClose();
    }
  }, [open, resolvedIndex, onClose]);

  if (!open || !current || !rect) return null;

  const isLast = resolvedIndex === steps.length - 1;
  const placement = current.placement ?? (rect.top > window.innerHeight / 2 ? "top" : "bottom");

  const tooltipStyle: React.CSSProperties =
    placement === "bottom"
      ? { top: rect.bottom + 16, left: Math.min(rect.left, window.innerWidth - 336) }
      : { bottom: window.innerHeight - rect.top + 16, left: Math.min(rect.left, window.innerWidth - 336) };

  return createPortal(
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[100]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Dimmed backdrop with a cutout over the spotlighted element */}
        <svg className="absolute inset-0 h-full w-full pointer-events-none">
          <defs>
            <mask id="spotlight-mask">
              <rect width="100%" height="100%" fill="white" />
              <rect
                x={rect.left - PADDING}
                y={rect.top - PADDING}
                width={rect.width + PADDING * 2}
                height={rect.height + PADDING * 2}
                rx={8}
                fill="black"
              />
            </mask>
          </defs>
          <rect width="100%" height="100%" fill="black" opacity={0.6} mask="url(#spotlight-mask)" />
        </svg>
        <div
          className="absolute rounded-lg pointer-events-none ring-2"
          style={{
            top: rect.top - PADDING,
            left: rect.left - PADDING,
            width: rect.width + PADDING * 2,
            height: rect.height + PADDING * 2,
            boxShadow: "0 0 0 2px #F0953E",
          }}
        />

        <motion.div
          key={resolvedIndex}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="absolute w-80 rounded-xl bg-[#0F1B2D] px-5 py-4 text-white shadow-xl"
          style={tooltipStyle}
        >
          {current.title && (
            <p className="text-sm font-semibold mb-1">{current.title}</p>
          )}
          <p className="text-sm text-white/80 leading-relaxed">{current.body}</p>
          <div className="mt-4 flex items-center justify-between">
            <span className="text-xs text-white/40">
              {resolvedIndex + 1} of {steps.length}
            </span>
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="text-xs text-white/50 hover:text-white/80 transition-colors"
              >
                Skip
              </button>
              <button
                onClick={() => (isLast ? onClose() : setIndex(resolvedIndex + 1))}
                className="rounded-md px-3 py-1.5 text-xs font-semibold text-white"
                style={{ background: "linear-gradient(135deg, #F0953E 0%, #C84A18 100%)" }}
              >
                {isLast ? "Done" : "Next"}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}

export function TourIntroModal({
  open,
  onStart,
  onSkip,
}: {
  open: boolean;
  onStart: () => void;
  onSkip: () => void;
}) {
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl">
        <h2 className="text-lg font-semibold text-gray-900">Welcome to Gravitas 👋</h2>
        <p className="mt-2 text-sm text-gray-500">
          Quick tour — 30 seconds, then you're off.
        </p>
        <div className="mt-5 flex items-center justify-center gap-3">
          <button
            onClick={onSkip}
            className="rounded-md px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700"
          >
            Skip
          </button>
          <button
            onClick={onStart}
            className="rounded-md px-4 py-2 text-sm font-semibold text-white"
            style={{ background: "linear-gradient(135deg, #F0953E 0%, #C84A18 100%)" }}
          >
            Show me
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
