import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { setInterviewEntry, INTERVIEW_TAGLINE } from "@/lib/entry";

const POINTS = [
  {
    title: "Questions matched to your interview",
    body: "Practice questions tailored to your industry, company and role.",
  },
  {
    title: "Specific feedback on four areas",
    body: "Thought clarity, vocal delivery, voice quality and, on video, physical delivery.",
  },
  {
    title: "See your progress",
    body: "Every session is scored, so you can watch your answers improve before the day.",
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
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-2">
            <img src="/gravitas-logo-light.png" alt="" className="h-8 w-auto" />
            <span
              className="text-2xl font-semibold text-foreground"
              style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
            >
              Gravitas
            </span>
          </div>
          <h1
            className="text-4xl font-semibold leading-tight text-foreground"
            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
          >
            {INTERVIEW_TAGLINE}
          </h1>
          <p className="text-base leading-relaxed text-muted-foreground">
            Practice real interview questions out loud and get specific feedback on your thought clarity, vocal delivery, voice quality and, on video, physical delivery.
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

        <div className="space-y-3">
          <Button
            className="w-full"
            onClick={() => start("/signup")}
            style={{ background: "linear-gradient(120deg,#F0953E 0%,#C84A18 100%)" }}
          >
            Create your account
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <button onClick={() => start("/login")} className="font-medium text-foreground underline">
              Sign in
            </button>
          </p>
          <p className="text-center text-xs text-muted-foreground">
            Your audio and video are deleted as soon as analysis finishes.
          </p>
        </div>
      </div>
    </div>
  );
}
