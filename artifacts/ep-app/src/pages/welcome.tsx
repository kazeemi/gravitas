import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";

export default function WelcomePage() {
  const [, setLocation] = useLocation();
  const { refreshUser } = useAuth();

  useEffect(() => {
    api.users.markWelcomeSeen()
      .then(() => refreshUser())
      .catch(() => {});
  }, [refreshUser]);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-5 py-12"
      style={{ backgroundColor: "#FBF7F2" }}
    >
      <div className="w-full max-w-lg space-y-10">

        {/* Header */}
        <div className="space-y-4">
          <p
            className="text-xs tracking-widest uppercase"
            style={{ fontFamily: "'DM Mono', monospace", color: "#F0953E" }}
          >
            Baseline complete
          </p>
          <h1
            className="text-4xl font-semibold leading-tight"
            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: "#0F1B2D" }}
          >
            You have taken the first step. Now let's build on it.
          </h1>
          <div className="space-y-3 text-base leading-relaxed" style={{ color: "#0F1B2D70" }}>
            <p>
              Gravitas exists for one reason — to help you show up at your best, in every room that matters.
            </p>
            <p>
              What you practise here is grounded in real research and real interviewer experience. It will be honest. It will be specific. And it will move with you as you grow.
            </p>
            <p style={{ color: "#0F1B2D90" }}>
              You have got this. Let's go.
            </p>
          </div>
        </div>

        {/* What your baseline means */}
        <div
          className="rounded-2xl px-6 py-6 space-y-5"
          style={{ backgroundColor: "#0F1B2D" }}
        >
          <div className="h-0.5 w-8 rounded-full" style={{ backgroundColor: "#F0953E" }} />
          <p
            className="text-xs tracking-widest uppercase"
            style={{ fontFamily: "'DM Mono', monospace", color: "rgba(255,255,255,0.35)" }}
          >
            What your baseline means
          </p>
          <div className="space-y-4">
            {[
              {
                heading: "It's honest, not harsh.",
                body: "Your scores reflect where you communicate today — not where you'll be in four weeks.",
              },
              {
                heading: "Every session builds on it.",
                body: "Each time you record, Gravitas tracks whether you're moving. The Progress page shows your arc over time.",
              },
              {
                heading: "The coaching is specific to you.",
                body: "Feedback is generated from what you said and how you said it — not from a generic template.",
              },
            ].map(({ heading, body }) => (
              <div key={heading} className="flex gap-4">
                <div
                  className="flex-shrink-0 mt-1.5 rounded-full"
                  style={{ width: "5px", height: "5px", backgroundColor: "#F0953E" }}
                />
                <div>
                  <p
                    className="text-sm font-semibold leading-snug"
                    style={{ color: "rgba(255,255,255,0.85)" }}
                  >
                    {heading}
                  </p>
                  <p
                    className="text-sm leading-relaxed mt-0.5"
                    style={{ color: "rgba(255,255,255,0.45)" }}
                  >
                    {body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* What's next */}
        <div className="space-y-3">
          <p
            className="text-xs tracking-widest uppercase"
            style={{ fontFamily: "'DM Mono', monospace", color: "#0F1B2D40" }}
          >
            What's next
          </p>
          <div className="space-y-2">
            {[
              { num: "01", text: "Record your next session — any prompt, any context." },
              { num: "02", text: "Review per-dimension coaching after each session." },
              { num: "03", text: "Watch your Progress page activate after your second session." },
            ].map(({ num, text }) => (
              <div
                key={num}
                className="flex items-start gap-4 rounded-xl px-5 py-4"
                style={{ backgroundColor: "white", border: "2px solid #0F1B2D08" }}
              >
                <span
                  className="text-xs tabular-nums flex-shrink-0 mt-0.5"
                  style={{ fontFamily: "'DM Mono', monospace", color: "#F0953E" }}
                >
                  {num}
                </span>
                <p className="text-sm leading-snug" style={{ color: "#0F1B2D75" }}>{text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <button
          onClick={() => setLocation("/dashboard")}
          className="w-full rounded-xl py-3.5 text-sm font-semibold text-white transition-all duration-150 hover:opacity-90 active:opacity-80"
          style={{ background: "linear-gradient(135deg, #F0953E 0%, #C84A18 100%)" }}
        >
          Start practising →
        </button>

      </div>
    </div>
  );
}
