import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const COMMUNICATION_CONTEXTS = [
  { value: "internal", label: "Internal meetings" },
  { value: "external", label: "External / client-facing" },
  { value: "presentations", label: "Presentations & keynotes" },
  { value: "mixed", label: "Mixed contexts" },
];

const RECORDING_CONTEXTS = [
  { value: "seated", label: "Seated (desk / conference room)" },
  { value: "standing", label: "Standing (podium / standing desk)" },
];

export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [roleTitle, setRoleTitle] = useState("");
  const [communicationContext, setCommunicationContext] = useState("");
  const [goal, setGoal] = useState("");
  const [defaultRecordingContext, setDefaultRecordingContext] = useState("seated");
  const [loading, setLoading] = useState(false);
  const { refreshUser } = useAuth();
  const [, setLocation] = useLocation();

  const handleFinish = async () => {
    setLoading(true);
    try {
      await api.users.completeOnboarding({
        roleTitle,
        communicationContext,
        goal,
        defaultRecordingContext,
      });
      await refreshUser();
      setLocation("/dashboard");
    } catch {
      setLocation("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Welcome to Executive Presence</h1>
          <p className="mt-2 text-sm text-gray-500">Let's personalize your experience</p>
          <div className="mt-4 flex justify-center gap-2">
            {[1, 2, 3].map(i => (
              <div
                key={i}
                className={`h-1.5 w-8 rounded-full transition-colors ${i <= step ? "bg-gray-900" : "bg-gray-200"}`}
              />
            ))}
          </div>
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Tell us about yourself</h2>
            <div>
              <Label htmlFor="roleTitle">Your role / title</Label>
              <Input
                id="roleTitle"
                value={roleTitle}
                onChange={(e) => setRoleTitle(e.target.value)}
                placeholder="e.g. VP of Engineering"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="goal">What's your primary goal?</Label>
              <Textarea
                id="goal"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="e.g. I want to improve my presence when presenting to the board."
                rows={3}
                className="mt-1"
              />
            </div>
            <Button className="w-full" onClick={() => setStep(2)}>
              Continue
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Your communication context</h2>
            <div className="space-y-2">
              {COMMUNICATION_CONTEXTS.map(ctx => (
                <label
                  key={ctx.value}
                  className={`flex items-center gap-3 rounded border p-3 cursor-pointer transition-colors ${
                    communicationContext === ctx.value
                      ? "border-gray-900 bg-gray-50"
                      : "border-gray-200"
                  }`}
                >
                  <input
                    type="radio"
                    name="communicationContext"
                    value={ctx.value}
                    checked={communicationContext === ctx.value}
                    onChange={() => setCommunicationContext(ctx.value)}
                    className="sr-only"
                  />
                  <span className={`h-4 w-4 rounded-full border-2 flex-shrink-0 ${
                    communicationContext === ctx.value ? "border-gray-900 bg-gray-900" : "border-gray-300"
                  }`} />
                  <span className="text-sm">{ctx.label}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>Back</Button>
              <Button className="flex-1" onClick={() => setStep(3)}>Continue</Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Your recording setup</h2>
            <div className="space-y-2">
              {RECORDING_CONTEXTS.map(ctx => (
                <label
                  key={ctx.value}
                  className={`flex items-center gap-3 rounded border p-3 cursor-pointer transition-colors ${
                    defaultRecordingContext === ctx.value
                      ? "border-gray-900 bg-gray-50"
                      : "border-gray-200"
                  }`}
                >
                  <input
                    type="radio"
                    name="recordingContext"
                    value={ctx.value}
                    checked={defaultRecordingContext === ctx.value}
                    onChange={() => setDefaultRecordingContext(ctx.value)}
                    className="sr-only"
                  />
                  <span className={`h-4 w-4 rounded-full border-2 flex-shrink-0 ${
                    defaultRecordingContext === ctx.value ? "border-gray-900 bg-gray-900" : "border-gray-300"
                  }`} />
                  <span className="text-sm">{ctx.label}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep(2)}>Back</Button>
              <Button className="flex-1" onClick={handleFinish} disabled={loading}>
                {loading ? "Saving..." : "Get started"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
