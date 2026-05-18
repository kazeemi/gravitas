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

const SECTORS = [
  { id: "consulting", label: "Consulting" },
  { id: "banking", label: "Banking & Finance" },
  { id: "tech", label: "Tech" },
  { id: "other", label: "Other" },
];

const COMPANIES_BY_SECTOR: Record<string, string[]> = {
  consulting: [
    "McKinsey & Company",
    "Boston Consulting Group (BCG)",
    "Bain & Company",
    "Deloitte Consulting",
    "Oliver Wyman",
    "Strategy& (PwC)",
    "Kearney",
    "Roland Berger",
    "L.E.K. Consulting",
    "Accenture Strategy",
  ],
  banking: [
    "Goldman Sachs",
    "Morgan Stanley",
    "J.P. Morgan",
    "BlackRock",
    "Blackstone",
    "KKR",
    "Citadel",
    "Apollo Global Management",
    "Carlyle Group",
    "Bank of America Merrill Lynch",
  ],
  tech: [
    "Google",
    "Amazon",
    "Microsoft",
    "Meta",
    "Apple",
    "Salesforce",
    "Uber",
    "Airbnb",
    "LinkedIn",
    "Stripe",
  ],
  other: [],
};

export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [roleTitle, setRoleTitle] = useState("");
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [interviewMode, setInterviewMode] = useState<boolean | null>(null);
  const [interviewSector, setInterviewSector] = useState("");
  const [interviewSectorCustom, setInterviewSectorCustom] = useState("");
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);
  const [companyCustom, setCompanyCustom] = useState("");
  const [loading, setLoading] = useState(false);
  const { refreshUser } = useAuth();
  const [, setLocation] = useLocation();

  const toggleGoal = (goal: string) => {
    setSelectedGoals(prev =>
      prev.includes(goal) ? prev.filter(g => g !== goal) : [...prev, goal]
    );
  };

  const toggleCompany = (company: string) => {
    setSelectedCompanies(prev =>
      prev.includes(company) ? prev.filter(c => c !== company) : [...prev, company]
    );
  };

  const totalSteps = interviewMode === true ? 5 : 3;

  const save = async (withInterview: boolean) => {
    setLoading(true);
    try {
      const companies = [...selectedCompanies];
      if (companyCustom.trim()) companies.push(companyCustom.trim());
      await api.users.completeOnboarding({
        roleTitle,
        goal: selectedGoals.join("; "),
        interviewMode: withInterview,
        interviewSector: withInterview ? (interviewSector || null) : null,
        interviewSectorCustom: withInterview && interviewSector === "other" ? (interviewSectorCustom.trim() || null) : null,
        interviewCompanies: withInterview && companies.length > 0 ? companies.join("; ") : null,
      });
      await refreshUser();
      setLocation("/dashboard");
    } catch {
      setLocation("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  const companiesList = COMPANIES_BY_SECTOR[interviewSector] ?? [];

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Welcome to Executive Presence</h1>
          <p className="mt-2 text-sm text-gray-500">Let's personalise your experience</p>
          <div className="mt-4 flex justify-center gap-2">
            {Array.from({ length: totalSteps }, (_, i) => i + 1).map(i => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i <= step ? "bg-gray-900 w-8" : "bg-gray-200 w-8"
                }`}
              />
            ))}
          </div>
        </div>

        {/* ── Step 1: Role ────────────────────────────────────────────── */}
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

        {/* ── Step 2: Goals ────────────────────────────────────────────── */}
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
                onClick={() => setStep(3)}
                disabled={selectedGoals.length === 0}
              >
                Continue
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 3: Job interview? ─────────────────────────────────── */}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold">Are you preparing for a job interview?</h2>
              <p className="text-sm text-gray-500 mt-1">
                We'll tailor your practice prompts to behavioral interview questions from your target sector.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => {
                  setInterviewMode(true);
                  setStep(4);
                }}
                className="rounded border-2 px-4 py-5 text-sm font-medium transition-colors border-gray-200 hover:border-gray-900 hover:bg-gray-50"
              >
                Yes
              </button>
              <button
                onClick={() => save(false)}
                disabled={loading}
                className="rounded border-2 px-4 py-5 text-sm font-medium transition-colors border-gray-200 hover:border-gray-900 hover:bg-gray-50 disabled:opacity-50"
              >
                {loading ? "Saving…" : "No"}
              </button>
            </div>
            <Button variant="outline" className="w-full" onClick={() => setStep(2)}>
              Back
            </Button>
          </div>
        )}

        {/* ── Step 4: Sector ────────────────────────────────────────── */}
        {step === 4 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold">Which sector are you targeting?</h2>
              <p className="text-sm text-gray-500 mt-1">Your prompts will be drawn from this area.</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {SECTORS.map(s => (
                <button
                  key={s.id}
                  onClick={() => {
                    setInterviewSector(s.id);
                    if (s.id !== "other") setInterviewSectorCustom("");
                  }}
                  className={`flex items-center justify-between rounded border px-4 py-3 text-sm text-left transition-colors ${
                    interviewSector === s.id
                      ? "border-gray-900 bg-gray-900 text-white"
                      : "border-gray-200 hover:border-gray-400"
                  }`}
                >
                  <span>{s.label}</span>
                  {interviewSector === s.id && <CheckIcon className="h-4 w-4 flex-shrink-0" />}
                </button>
              ))}
            </div>
            {interviewSector === "other" && (
              <div>
                <p className="text-xs text-gray-400 mb-1">Which sector?</p>
                <input
                  type="text"
                  value={interviewSectorCustom}
                  onChange={(e) => setInterviewSectorCustom(e.target.value)}
                  placeholder="e.g. Healthcare, Real Estate"
                  className="w-full rounded border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-900"
                  autoFocus
                />
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep(3)}>
                Back
              </Button>
              <Button
                className="flex-1"
                onClick={() => setStep(5)}
                disabled={!interviewSector || (interviewSector === "other" && !interviewSectorCustom.trim())}
              >
                Continue
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 5: Companies ─────────────────────────────────────── */}
        {step === 5 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold">Which companies are you targeting?</h2>
              <p className="text-sm text-gray-500 mt-1">Select all that apply — or skip if you're not sure yet.</p>
            </div>
            {companiesList.length > 0 && (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {companiesList.map(company => {
                  const selected = selectedCompanies.includes(company);
                  return (
                    <button
                      key={company}
                      onClick={() => toggleCompany(company)}
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
                      <span>{company}</span>
                    </button>
                  );
                })}
              </div>
            )}
            <div>
              <p className="text-xs text-gray-400 mb-1">
                {companiesList.length > 0 ? "Add another company:" : "Which company?"}
              </p>
              <input
                type="text"
                value={companyCustom}
                onChange={(e) => setCompanyCustom(e.target.value)}
                placeholder="e.g. Bridgewater Associates"
                className="w-full rounded border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-900"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep(4)}>
                Back
              </Button>
              <Button
                className="flex-1"
                onClick={() => save(true)}
                disabled={loading}
              >
                {loading ? "Saving…" : "Get started"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
