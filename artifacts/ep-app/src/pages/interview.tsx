import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { setInterviewEntry } from "@/lib/entry";

const POINTS = [
  {
    title: "See what the interviewer sees",
    body: "Get specific feedback on how clearly you think, how your voice comes across and how you present yourself, not just the content of your answer.",
  },
  {
    title: "Know exactly what to fix",
    body: "Every answer comes with honest, specific feedback and a clear next step, based on a real coaching methodology rather than generic tips.",
  },
  {
    title: "Know when you're ready",
    body: "Track your performance across sessions and see where your presence is improving and where to keep working.",
  },
];

export default function InterviewLandingPage() {
  const [, setLocation] = useLocation();

  const start = (to: "/signup" | "/login") => {
    setInterviewEntry();
    // A leftover draft from an earlier visit must not override this choice.
    try { localStorage.removeItem("gravitas_onboarding_draft"); } catch {}
    setLocation(to);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-5 py-8 sm:py-10">
      <div className="w-full max-w-md space-y-7">
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center gap-3">
            <img src="/gravitas-logo-light.png" alt="" className="h-11 w-auto sm:h-12" />
            <span
              className="text-4xl sm:text-5xl font-semibold text-foreground"
              style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
            >
              Gravitas
            </span>
          </div>
          <h1
            className="text-4xl sm:text-5xl font-semibold leading-tight text-foreground"
            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
          >
            Walk in prepared.<br />Speak with presence.
          </h1>
          <p className="text-base leading-relaxed text-muted-foreground">
            Practice real interview questions out loud and get specific feedback on how clearly you think, how confidently you speak, and how you show up on camera.
          </p>
          <p className="text-sm text-muted-foreground">
            Questions tailored to your role, company and industry.
          </p>
        </div>

        <div className="space-y-3">
          {POINTS.map((p, i) => (
            <div key={p.title} className="rounded-2xl border border-border bg-white px-5 py-4">
              <div className="flex items-start gap-4">
                <span className="mt-0.5 text-xs tabular-nums" style={{ fontFamily: "'DM Mono', monospace", color: "#F0953E" }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground">{p.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{p.body}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <p className="px-2 text-center text-xs leading-relaxed text-muted-foreground">
          Built by an executive coach and former McKinsey interviewer. Designed from hundreds of real interviews and years of coaching leaders on how to show up with presence.
        </p>

        <div className="space-y-3">
          <Button
            className="w-full shadow-lg shadow-[#F0953E]/30"
            onClick={() => start("/signup")}
            style={{ background: "linear-gradient(120deg,#F0953E 0%,#C84A18 100%)" }}
          >
            Create your account
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <button onClick={() => start("/login")} className="font-semibold underline underline-offset-2" style={{ color: "#C84A18" }}>
              Sign in
            </button>
          </p>
          <p className="text-center text-xs text-muted-foreground">
            Your audio and video are deleted from our servers after analysis.
          </p>
        </div>
      </div>
    </div>
  );
}
