import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { CheckIcon } from "lucide-react";

const ROLE_OPTIONS = [
  "CEO / President",
  "C-Suite Executive (CFO, COO, CTO, CMO)",
  "VP / Senior VP",
  "Director",
  "Senior Manager / Manager",
  "Team Lead",
  "Individual Contributor",
  "Founder / Entrepreneur",
  "Board Member / Advisor",
  "Consultant / Coach",
  "Sales / Business Development",
  "Other",
];

const GOAL_OPTIONS = [
  "Improve confidence when speaking to senior leadership",
  "Reduce filler words and verbal hesitation",
  "Strengthen executive presence in large presentations",
  "Communicate more clearly and concisely",
  "Improve storytelling and narrative structure",
  "Increase vocal authority and gravitas",
  "Enhance presence in video calls and virtual meetings",
  "Prepare for a board presentation or keynote",
  "Build persuasiveness in negotiations and pitches",
  "Develop a more commanding physical presence",
];

export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [roleTitle, setRoleTitle] = useState("");
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const { refreshUser } = useAuth();
  const [, setLocation] = useLocation();

  const toggleGoal = (goal: string) => {
    setSelectedGoals(prev =>
      prev.includes(goal) ? prev.filter(g => g !== goal) : [...prev, goal]
    );
  };

  const handleFinish = async () => {
    setLoading(true);
    try {
      await api.users.completeOnboarding({
        roleTitle,
        goal: selectedGoals.join("; "),
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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Welcome to Executive Presence</h1>
          <p className="mt-2 text-sm text-gray-500">Let's personalize your experience</p>
          <div className="mt-4 flex justify-center gap-2">
            {[1, 2].map(i => (
              <div
                key={i}
                className={`h-1.5 w-8 rounded-full transition-colors ${i <= step ? "bg-gray-900" : "bg-gray-200"}`}
              />
            ))}
          </div>
        </div>

        {step === 1 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold">Tell us about yourself</h2>
              <p className="text-sm text-gray-500 mt-1">Select your current role</p>
            </div>
            <div className="grid grid-cols-1 gap-2 max-h-80 overflow-y-auto">
              {ROLE_OPTIONS.map(role => (
                <button
                  key={role}
                  onClick={() => setRoleTitle(role)}
                  className={`flex items-center justify-between rounded border px-4 py-3 text-sm text-left transition-colors ${
                    roleTitle === role
                      ? "border-gray-900 bg-gray-900 text-white"
                      : "border-gray-200 hover:border-gray-400"
                  }`}
                >
                  <span>{role}</span>
                  {roleTitle === role && <CheckIcon className="h-4 w-4 flex-shrink-0" />}
                </button>
              ))}
            </div>
            <div className="pt-1">
              <p className="text-xs text-gray-400 mb-1">Or type your own title:</p>
              <input
                type="text"
                value={ROLE_OPTIONS.includes(roleTitle) ? "" : roleTitle}
                onChange={(e) => setRoleTitle(e.target.value)}
                placeholder="e.g. Head of Product"
                className="w-full rounded border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-900"
              />
            </div>
            <Button className="w-full" onClick={() => setStep(2)} disabled={!roleTitle}>
              Continue
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold">What are your goals?</h2>
              <p className="text-sm text-gray-500 mt-1">Select all that apply</p>
            </div>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {GOAL_OPTIONS.map(goal => {
                const selected = selectedGoals.includes(goal);
                return (
                  <button
                    key={goal}
                    onClick={() => toggleGoal(goal)}
                    className={`flex items-start gap-3 w-full rounded border px-4 py-3 text-sm text-left transition-colors ${
                      selected
                        ? "border-gray-900 bg-gray-50"
                        : "border-gray-200 hover:border-gray-400"
                    }`}
                  >
                    <span
                      className={`mt-0.5 h-4 w-4 flex-shrink-0 rounded border-2 flex items-center justify-center ${
                        selected ? "border-gray-900 bg-gray-900" : "border-gray-300"
                      }`}
                    >
                      {selected && <CheckIcon className="h-3 w-3 text-white" />}
                    </span>
                    <span>{goal}</span>
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button
                className="flex-1"
                onClick={handleFinish}
                disabled={selectedGoals.length === 0 || loading}
              >
                {loading ? "Saving..." : "Get started"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
