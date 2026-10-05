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
    <div className="min-h-screen flex items-center justify-center bg-background px-5 py-6 md:py-3">
      <div className="w-full max-w-5xl space-y-5 md:space-y-4">
        <div className="text-center space-y-2 md:space-y-2.5">
          <div className="flex items-center justify-center gap-4">
            <img src="/gravitas-logo-light.png" alt="" className="h-20 w-auto md:h-28 md:-my-5" />
            <span
              className="text-5xl md:text-6xl font-semibold text-foreground"
              style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
            >
              Gravitas
            </span>
          </div>
          <h1
            className="text-3xl md:text-4xl font-semibold leading-tight text-foreground"
            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
          >
            Walk in prepared.<br />Speak with presence.
          </h1>
          <p className="mx-auto max-w-3xl text-base md:text-lg leading-relaxed text-muted-foreground">
            Practice real interview questions out loud and get specific feedback on how clearly you think, how confidently you speak, and how you show up on camera.
          </p>
          <p className="text-sm md:text-base text-muted-foreground">
            Questions tailored to your role, company and industry.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3 md:gap-4">
          {POINTS.map((p) => (
            <div key={p.title} className="rounded-2xl border border-border bg-white px-5 py-4 md:px-6 md:py-4">
              <p className="text-lg font-semibold text-foreground">
                {p.title}
              </p>
              <p className="mt-1.5 text-base leading-relaxed text-muted-foreground">{p.body}</p>
            </div>
          ))}
        </div>

        <p className="mx-auto max-w-3xl px-2 text-center text-sm md:text-base leading-relaxed text-muted-foreground">
          Built by an executive coach and former McKinsey interviewer. Designed from hundreds of real interviews and years of coaching leaders on how to show up with presence.
        </p>

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
