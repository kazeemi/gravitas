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
