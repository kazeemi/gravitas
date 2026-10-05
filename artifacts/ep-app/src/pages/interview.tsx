import { Fragment } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { setInterviewEntry } from "@/lib/entry";
import { BrandMark } from "@/components/brand-mark";

const ORANGE = "#F0953E";
const TERRACOTTA = "#C84A18";
const MONO = "'DM Mono', monospace";
const SERIF = "'Cormorant Garamond', Georgia, serif";

const STEPS = [
  {
    num: "01",
    title: "See what the interviewer sees",
    body: "Get specific feedback on how clearly you think, how your voice comes across and how you present yourself, not just the content of your answer.",
  },
  {
    num: "02",
    title: "Know exactly what to improve",
    body: "Every answer comes with honest, specific feedback and a clear next step, based on a real coaching methodology rather than generic tips.",
  },
  {
    num: "03",
    title: "Know when you're ready",
    body: "Track your performance across sessions and see where your presence is improving and where to keep working.",
  },
];

function JourneyArrow() {
  return (
    <div className="flex h-12 items-center justify-center md:h-auto md:px-2" aria-hidden="true">
      <svg viewBox="0 0 40 24" className="h-6 w-10 rotate-90 md:rotate-0" fill="none" stroke={ORANGE} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="2" y1="12" x2="36" y2="12" />
        <polyline points="28,4 37,12 28,20" />
      </svg>
    </div>
  );
}

export default function InterviewLandingPage() {
  const [, setLocation] = useLocation();

  const start = (to: "/signup" | "/login") => {
    setInterviewEntry();
    // A leftover draft from an earlier visit must not override this choice.
    try { localStorage.removeItem("gravitas_onboarding_draft"); } catch {}
    setLocation(to);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-5 py-6 md:py-3">
      <div className="w-full max-w-5xl space-y-5 md:space-y-3">
        <div className="text-center space-y-2 md:space-y-2.5">
          <BrandMark />
          <h1
            className="pt-1 text-3xl md:text-4xl font-semibold leading-tight text-foreground"
            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
          >
            Walk in prepared.<br className="md:hidden" /> Speak with presence.
          </h1>
          <p className="mx-auto max-w-3xl text-base md:text-lg leading-relaxed text-muted-foreground">
            Practice real interview questions out loud and get specific feedback on how clearly you think, how confidently you speak, and how you show up on camera.
          </p>
          <p className="text-sm md:text-base text-muted-foreground">
            Questions tailored to your role, company and industry.
          </p>
          <div className="mx-auto h-0.5 w-12 rounded-full" style={{ backgroundColor: ORANGE }} />
        </div>

        <div className="flex flex-col items-stretch md:flex-row">
          {STEPS.map((step, i) => (
            <Fragment key={step.num}>
              {i > 0 && <JourneyArrow />}
              <div className="flex-1 rounded-2xl border border-border bg-white px-5 py-4 md:px-5 md:py-3.5">
                <span className="text-sm font-medium tabular-nums" style={{ fontFamily: MONO, color: ORANGE }}>
                  {step.num}
                </span>
                <p className="mt-0.5 text-lg font-semibold leading-snug" style={{ color: TERRACOTTA }}>
                  {step.title}
                </p>
                <p className="mt-1.5 text-base leading-relaxed text-muted-foreground">{step.body}</p>
              </div>
            </Fragment>
          ))}
        </div>

        <div className="mx-auto max-w-3xl px-2 text-center">
          <p className="text-xs font-medium uppercase tracking-[0.2em]" style={{ fontFamily: MONO, color: TERRACOTTA }}>
            Built from the other side of the table
          </p>
          <p className="mt-1 text-base font-semibold text-foreground md:text-lg">
            Executive coach <span style={{ color: ORANGE }}>·</span> Former McKinsey interviewer <span style={{ color: ORANGE }}>·</span> Hundreds of interviews
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Designed from real interviews and years of coaching leaders on how to show up with presence.
          </p>
        </div>

        <div className="mx-auto max-w-md space-y-2.5">
          <Button
            className="w-full h-12 text-base shadow-lg shadow-[#F0953E]/30"
            onClick={() => start("/signup")}
            style={{ background: "linear-gradient(120deg,#F0953E 0%,#C84A18 100%)" }}
          >
            Create your account
          </Button>
          <p className="text-center text-base text-muted-foreground">
            Already have an account?{" "}
            <button onClick={() => start("/login")} className="font-semibold underline underline-offset-2" style={{ color: "#C84A18" }}>
              Sign in
            </button>
          </p>
          <p className="text-center text-sm text-muted-foreground">
            Your audio and video are deleted from our servers after analysis.
          </p>
        </div>
      </div>
    </div>
  );
}
