import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";

export default function WelcomePage() {
  const [, setLocation] = useLocation();
  const { refreshUser } = useAuth();

  const handleBegin = async () => {
    try {
      await api.users.markWelcomeSeen();
      await refreshUser();
    } catch {
      // non-fatal — proceed anyway
    }
    setLocation("/record");
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-between px-6 py-12"
      style={{ backgroundColor: "#0F1117" }}
    >
      <div className="flex flex-col items-center w-full max-w-4xl flex-1 justify-center gap-10">

        <div className="text-center space-y-3">
          <h1
            className="text-4xl md:text-5xl text-[#F5F0E8]"
            style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
          >
            Welcome to Gravitas.
          </h1>
          <p
            className="text-xl md:text-2xl text-[#D4A853] italic"
            style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
          >
            Your personal executive presence coach. Here is how it works.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 w-full">
          {[
            {
              number: "1",
              title: "Choose a prompt",
              body: "Select a professional scenario or write your own.",
            },
            {
              number: "2",
              title: "Record",
              body: "Record your response in audio or video mode. Sessions run 1 to 10 minutes.",
            },
            {
              number: "3",
              title: "Get your scores and coaching",
              body: "Get your scores, evidence-based coaching feedback for up to 15 dimensions of executive presence.",
            },
          ].map((card) => (
            <div
              key={card.number}
              className="flex flex-col gap-3 rounded-lg px-5 py-5"
              style={{
                backgroundColor: "#1A1D27",
                borderTop: "3px solid #D4A853",
              }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="text-[#D4A853] text-xs font-semibold uppercase tracking-widest"
                  style={{ fontFamily: "Calibri, 'Segoe UI', sans-serif" }}
                >
                  Step {card.number}
                </span>
              </div>
              <h3
                className="text-[#F5F0E8] text-lg font-semibold"
                style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
              >
                {card.title}
              </h3>
              <p
                className="text-[#9CA3AF] text-sm leading-relaxed"
                style={{ fontFamily: "Calibri, 'Segoe UI', sans-serif" }}
              >
                {card.body}
              </p>
            </div>
          ))}
        </div>

        <p
          className="text-center text-[#9CA3AF] max-w-xl"
          style={{ fontFamily: "Calibri, 'Segoe UI', sans-serif", fontSize: "13px" }}
        >
          After two sessions, your Progress page unlocks. You will see how your scores are moving
          across every dimension — where you are improving and where to focus next.
        </p>

        <button
          onClick={handleBegin}
          className="rounded-lg px-10 py-3.5 text-base font-semibold text-[#0F1117] transition-opacity hover:opacity-90 active:opacity-80"
          style={{
            backgroundColor: "#D4A853",
            fontFamily: "Georgia, 'Times New Roman', serif",
          }}
        >
          Let's begin →
        </button>
      </div>

      <p
        className="text-center mt-8 max-w-2xl"
        style={{
          fontFamily: "Calibri, 'Segoe UI', sans-serif",
          fontSize: "11px",
          color: "rgba(245, 240, 232, 0.35)",
        }}
      >
        Built on McKinsey-level analytical rigour and Executive Coaching methodology. Your recording
        is deleted immediately after scoring. During beta, transcripts are accessible to the Gravitas
        team for scoring validation only.
      </p>
    </div>
  );
}
