import { useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

interface ConsentGateProps {
  onAccepted: () => void;
}

export function ConsentGate({ onAccepted }: ConsentGateProps) {
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleAccept = async () => {
    if (!accepted) return;
    setLoading(true);
    setError("");
    try {
      await api.users.recordConsent();
      onAccepted();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl overflow-hidden">
        <div className="bg-[#0F1B2D] px-8 py-6 text-center">
          <span
            className="text-2xl font-semibold text-[#FBF7F2]"
            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
          >
            Gravitas
          </span>
        </div>

        <div className="px-8 py-8 space-y-5">
          <div>
            <h2 className="text-lg font-semibold text-[#0F1B2D] mb-2">
              We've updated our Terms & Privacy Policy
            </h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              To continue using Gravitas, please review and accept our updated policies. These cover how we handle your voice recordings, session data, and AI-generated feedback.
            </p>
          </div>

          <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 text-xs text-gray-600 space-y-1.5 leading-relaxed">
            <p><strong className="text-[#0F1B2D]">What we process:</strong> Your audio/video recordings, transcripts, and coaching feedback.</p>
            <p><strong className="text-[#0F1B2D]">Who sees it:</strong> OpenAI (transcription) and Anthropic (coaching analysis). Neither trains on your data.</p>
            <p><strong className="text-[#0F1B2D]">How long we keep it:</strong> Session history is kept for the lifetime of your account so you can track long-term progress. You can delete individual sessions or your entire account at any time.</p>
          </div>

          <div className="flex items-start gap-3">
            <Checkbox
              id="consent-gate"
              checked={accepted}
              onCheckedChange={(v) => setAccepted(v === true)}
              className="mt-0.5 shrink-0"
            />
            <label htmlFor="consent-gate" className="text-xs text-gray-600 leading-relaxed cursor-pointer">
              I agree to the{" "}
              <a href="/terms" target="_blank" rel="noopener noreferrer" className="font-medium text-gray-900 underline">
                Terms of Service
              </a>{" "}
              and{" "}
              <a href="/privacy" target="_blank" rel="noopener noreferrer" className="font-medium text-gray-900 underline">
                Privacy Policy
              </a>
              , including processing of my voice and video by AI services to deliver coaching.
            </label>
          </div>

          {error && (
            <p className="text-xs text-red-600">{error}</p>
          )}

          <Button
            onClick={handleAccept}
            disabled={!accepted || loading}
            className="w-full"
            style={{
              background: accepted ? "linear-gradient(120deg,#F0953E 0%,#C84A18 100%)" : undefined,
            }}
          >
            {loading ? "Saving..." : "Accept and continue"}
          </Button>
        </div>
      </div>
    </div>
  );
}
