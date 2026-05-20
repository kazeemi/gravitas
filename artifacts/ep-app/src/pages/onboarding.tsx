import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";

const ONBOARDING_DRAFT_KEY = "gravitas_onboarding_draft";

const BASELINE_PROMPTS = {
  interview: {
    prompt: "Tell me about yourself.",
    instruction: "Take 30 seconds to think and structure your thoughts in your mind. Do not script it. Then speak as if you are opening a real interview. This is your starting point — not a test.",
    duration: "90 seconds recommended",
  },
  workplace: {
    prompt: "Walk me through a project you're currently working on and why it matters.",
    instruction: "Take 30 seconds to think and structure your thoughts in your mind. Do not script it. Speak as if you are briefing a senior leader. This is your starting point — not a test.",
    duration: "90 seconds recommended",
  },
};

// ── Data constants ────────────────────────────────────────────────────────────

const EDUCATION_LEVELS = [
  { id: "high_school", label: "High School" },
  { id: "undergraduate", label: "Undergraduate Degree" },
  { id: "masters", label: "Master's Degree" },
  { id: "mba", label: "MBA" },
  { id: "doctorate", label: "Doctorate / PhD" },
  { id: "professional", label: "Other Professional Qualification" },
  { id: "prefer_not", label: "Prefer not to say" },
];

const EXPERIENCE_YEARS = [
  { id: "0", label: "0 years" },
  { id: "1_3", label: "1–3 years" },
  { id: "4_7", label: "4–7 years" },
  { id: "8_12", label: "8–12 years" },
  { id: "13_20", label: "13–20 years" },
  { id: "20+", label: "20+ years" },
];

const INDUSTRIES = [
  { id: "consulting", label: "Consulting" },
  { id: "banking", label: "Banking & Finance" },
  { id: "technology", label: "Technology" },
  { id: "other", label: "Other" },
];

const COMPANIES_BY_INDUSTRY: Record<string, string[]> = {
  consulting: ["McKinsey & Company", "Bain & Company", "Boston Consulting Group", "Oliver Wyman", "Strategy&"],
  banking: ["Goldman Sachs", "J.P. Morgan", "Morgan Stanley", "BlackRock", "Citi"],
  technology: ["Google", "Microsoft", "Amazon", "Meta", "Apple"],
};

const INTERVIEW_TIMELINES = [
  "Within 2 weeks",
  "Within a month",
  "Within 3 months",
  "No specific date — general preparation",
];

const WORK_ENVIRONMENTS = [
  { id: "corporate", label: "Corporate" },
  { id: "consulting", label: "Consulting / Advisory" },
  { id: "finance", label: "Finance" },
  { id: "technology", label: "Technology" },
  { id: "government", label: "Government / Public Sector" },
  { id: "startup", label: "Entrepreneurship / Startup" },
  { id: "academia", label: "Academia / Research" },
  { id: "other", label: "Other" },
];

const WORKPLACE_ROLES = [
  "Individual Contributor",
  "Team Manager",
  "Senior Manager",
  "Director / VP",
  "Executive / C-Suite",
  "Founder / Entrepreneur",
  "Consultant / Advisor",
  "Other",
];

const HIGH_STAKES_CONTEXTS = [
  "Leadership Meetings",
  "Presentations",
  "Team Management",
  "Client / Stakeholder Interactions",
  "Public Speaking",
  "Difficult Conversations",
  "Networking & Relationship Building",
  "Board / Executive Interactions",
  "Cross-Functional Collaboration",
  "Media / External Presence",
];


// ── Step definitions ──────────────────────────────────────────────────────────

type StepId =
  | "welcome"
  | "education" | "experience" | "primary_goal"
  | "industry" | "company" | "role" | "interview_confirmed" | "interview_detail"
  | "environment" | "current_role" | "high_stakes"
  | "emotional_connect" | "privacy_trust" | "how_it_works"
  | "baseline";

const META_STEPS: StepId[] = ["emotional_connect", "privacy_trust", "how_it_works"];

type Path = "interview" | "workplace" | null;

function getStepList(path: Path): StepId[] {
  const common: StepId[] = ["experience", "education", "primary_goal"];
  const bridge: StepId[] = ["emotional_connect", "privacy_trust", "how_it_works"];
  if (path === "interview") {
    return [...common, "industry", "company", "role", "interview_confirmed", "interview_detail", ...bridge, "baseline"];
  }
  if (path === "workplace") {
    return [...common, "environment", "current_role", "high_stakes", ...bridge, "baseline"];
  }
  return common;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function OptionCard({
  label,
  sub,
  selected,
  onClick,
}: {
  label: string;
  sub?: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-xl border-2 px-4 py-3.5 transition-all duration-150 ${
        selected
          ? "border-[#F0953E] bg-[#F0953E]/8"
          : "border-[#0F1B2D]/12 bg-white hover:border-[#F0953E]/50 hover:bg-[#F0953E]/4"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className={`text-sm font-medium leading-tight ${selected ? "text-[#0F1B2D]" : "text-[#0F1B2D]/80"}`}>
            {label}
          </p>
          {sub && <p className="text-xs text-[#0F1B2D]/45 mt-0.5">{sub}</p>}
        </div>
        <div
          className={`h-4 w-4 flex-shrink-0 rounded-full border-2 flex items-center justify-center transition-all ${
            selected ? "border-[#F0953E] bg-[#F0953E]" : "border-[#0F1B2D]/20"
          }`}
        >
          {selected && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
        </div>
      </div>
    </button>
  );
}

function CheckCard({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-xl border-2 px-4 py-3.5 transition-all duration-150 ${
        selected
          ? "border-[#F0953E] bg-[#F0953E]/8"
          : "border-[#0F1B2D]/12 bg-white hover:border-[#F0953E]/50 hover:bg-[#F0953E]/4"
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`h-4 w-4 flex-shrink-0 rounded border-2 flex items-center justify-center transition-all ${
            selected ? "border-[#F0953E] bg-[#F0953E]" : "border-[#0F1B2D]/20"
          }`}
        >
          {selected && (
            <svg viewBox="0 0 10 10" className="h-2.5 w-2.5 fill-none stroke-white stroke-[1.8]">
              <polyline points="1.5,5 4,7.5 8.5,2" />
            </svg>
          )}
        </div>
        <span className={`text-sm font-medium ${selected ? "text-[#0F1B2D]" : "text-[#0F1B2D]/80"}`}>
          {label}
        </span>
      </div>
    </button>
  );
}


function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 text-sm transition-colors"
      style={{ color: "#0F1B2D45" }}
    >
      <svg viewBox="0 0 16 16" className="h-4 w-4 fill-none stroke-current stroke-[1.5]">
        <polyline points="10,3 5,8 10,13" />
      </svg>
      Back
    </button>
  );
}

function ContinueButton({ onClick, disabled, label = "Continue" }: { onClick: () => void; disabled?: boolean; label?: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full rounded-xl py-3.5 text-sm font-semibold text-white transition-all duration-150 hover:opacity-90 active:opacity-80 disabled:opacity-40"
      style={{ background: "linear-gradient(135deg, #F0953E 0%, #C84A18 100%)" }}
    >
      {label}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const { refreshUser } = useAuth();
  const [, setLocation] = useLocation();

  const [currentStep, setCurrentStep] = useState<StepId>("welcome");
  const [path, setPath] = useState<Path>(null);
  const [loading, setLoading] = useState(false);

  // Professional profile
  const [educationLevel, setEducationLevel] = useState("");
  const [workExperienceYears, setWorkExperienceYears] = useState("");

  // Interview path
  const [industry, setIndustry] = useState("");
  const [industryCustom, setIndustryCustom] = useState("");
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);
  const [companyCustom, setCompanyCustom] = useState("");
  const [interviewRole, setInterviewRole] = useState("");
  const [hasConfirmedInterview, setHasConfirmedInterview] = useState<boolean | null>(null);
  const [interviewDate, setInterviewDate] = useState("");
  const [interviewTimeline, setInterviewTimeline] = useState("");

  // Workplace path
  const [workEnvironment, setWorkEnvironment] = useState("");
  const [workEnvironmentCustom, setWorkEnvironmentCustom] = useState("");
  const [workCurrentRole, setWorkCurrentRole] = useState("");
  const [workCurrentRoleCustom, setWorkCurrentRoleCustom] = useState("");
  const [highStakesContexts, setHighStakesContexts] = useState<string[]>([]);

  // ── localStorage persistence ─────────────────────────────────────────────────
  const hasRestoredRef = useRef(false);

  useEffect(() => {
    const isFresh = new URLSearchParams(window.location.search).get("fresh") === "1";
    if (isFresh) {
      try { localStorage.removeItem(ONBOARDING_DRAFT_KEY); } catch {}
      return;
    }
    try {
      const raw = localStorage.getItem(ONBOARDING_DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw) as Record<string, unknown>;
        if (d.currentStep) setCurrentStep(d.currentStep as StepId);
        if (d.path) setPath(d.path as Path);
        if (d.educationLevel) setEducationLevel(d.educationLevel as string);
        if (d.workExperienceYears) setWorkExperienceYears(d.workExperienceYears as string);
        if (d.industry) setIndustry(d.industry as string);
        if (d.industryCustom) setIndustryCustom(d.industryCustom as string);
        if (Array.isArray(d.selectedCompanies)) setSelectedCompanies(d.selectedCompanies as string[]);
        if (d.companyCustom) setCompanyCustom(d.companyCustom as string);
        if (d.interviewRole) setInterviewRole(d.interviewRole as string);
        if (typeof d.hasConfirmedInterview === "boolean") setHasConfirmedInterview(d.hasConfirmedInterview);
        if (d.interviewDate) setInterviewDate(d.interviewDate as string);
        if (d.interviewTimeline) setInterviewTimeline(d.interviewTimeline as string);
        if (d.workEnvironment) setWorkEnvironment(d.workEnvironment as string);
        if (d.workEnvironmentCustom) setWorkEnvironmentCustom(d.workEnvironmentCustom as string);
        if (d.workCurrentRole) setWorkCurrentRole(d.workCurrentRole as string);
        if (d.workCurrentRoleCustom) setWorkCurrentRoleCustom(d.workCurrentRoleCustom as string);
        if (Array.isArray(d.highStakesContexts)) setHighStakesContexts(d.highStakesContexts as string[]);
      }
    } catch {}
    hasRestoredRef.current = true;
  }, []);

  useEffect(() => {
    if (!hasRestoredRef.current) return;
    try {
      localStorage.setItem(ONBOARDING_DRAFT_KEY, JSON.stringify({
        currentStep, path,
        educationLevel, workExperienceYears,
        industry, industryCustom, selectedCompanies, companyCustom,
        interviewRole, hasConfirmedInterview, interviewDate, interviewTimeline,
        workEnvironment, workEnvironmentCustom, workCurrentRole, workCurrentRoleCustom,
        highStakesContexts,
      }));
    } catch {}
  }, [
    currentStep, path,
    educationLevel, workExperienceYears,
    industry, industryCustom, selectedCompanies, companyCustom,
    interviewRole, hasConfirmedInterview, interviewDate, interviewTimeline,
    workEnvironment, workEnvironmentCustom, workCurrentRole, workCurrentRoleCustom,
    highStakesContexts,
  ]);

  // ── Step navigation ─────────────────────────────────────────────────────────

  const steps = getStepList(path);
  const currentIndex = steps.indexOf(currentStep);
  const nonMetaSteps = steps.filter(s => !META_STEPS.includes(s));
  const displayTotal = nonMetaSteps.length;
  const displayIndex = nonMetaSteps.indexOf(currentStep) + 1;

  const goNext = () => {
    const nextIdx = currentIndex + 1;
    if (nextIdx < steps.length) setCurrentStep(steps[nextIdx]);
  };

  const goBack = () => {
    const prevIdx = currentIndex - 1;
    if (prevIdx >= 0) setCurrentStep(steps[prevIdx]);
  };

  const selectAndAdvance = (setter: (v: string) => void, value: string) => {
    setter(value);
    const nextSteps = getStepList(path);
    const nextIdx = nextSteps.indexOf(currentStep) + 1;
    if (nextIdx < nextSteps.length) setCurrentStep(nextSteps[nextIdx]);
  };

  const setPrimaryGoalAndAdvance = (goal: "interview_prep" | "workplace_presence") => {
    const newPath: Path = goal === "interview_prep" ? "interview" : "workplace";
    setPath(newPath);
    const newSteps = getStepList(newPath);
    const nextStep = newSteps[newSteps.indexOf("primary_goal") + 1];
    setCurrentStep(nextStep);
  };

  const toggleCompany = (c: string) =>
    setSelectedCompanies(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);

  const toggleContext = (c: string) =>
    setHighStakesContexts(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);

  // ── Save ────────────────────────────────────────────────────────────────────

  const save = async () => {
    setLoading(true);
    try {
      const companies = [...selectedCompanies];
      if (companyCustom.trim()) companies.push(companyCustom.trim());

      await api.users.completeOnboarding({
        primaryGoal: path === "interview" ? "interview_prep" : "workplace_presence",
        educationLevel: educationLevel || null,
        workExperienceYears: workExperienceYears || null,
        interviewMode: path === "interview",
        interviewSector: path === "interview" ? (industry || null) : null,
        interviewSectorCustom: path === "interview" && industry === "other" ? (industryCustom.trim() || null) : null,
        interviewCompanies: path === "interview" && companies.length > 0 ? companies.join("; ") : null,
        interviewRole: path === "interview" ? (interviewRole.trim() || null) : null,
        hasConfirmedInterview: path === "interview" ? hasConfirmedInterview : null,
        interviewDate: path === "interview" && hasConfirmedInterview ? (interviewDate || null) : null,
        interviewTimeline: path === "interview" && !hasConfirmedInterview ? (interviewTimeline || null) : null,
        workEnvironment: path === "workplace" ? (workEnvironment || null) : null,
        workCurrentRole: path === "workplace" ? (workCurrentRole || null) : null,
        workCurrentRoleCustom: path === "workplace" && workCurrentRole === "Other" ? (workCurrentRoleCustom.trim() || null) : null,
        highStakesContexts: path === "workplace" && highStakesContexts.length > 0 ? highStakesContexts.join("; ") : null,
      });
      await refreshUser();
      try { localStorage.removeItem(ONBOARDING_DRAFT_KEY); } catch {}
      const bp = path === "interview" ? BASELINE_PROMPTS.interview : BASELINE_PROMPTS.workplace;
      setLocation(`/record?baseline=1&prompt=${encodeURIComponent(bp.prompt)}&instruction=${encodeURIComponent(bp.instruction)}&duration=${encodeURIComponent(bp.duration)}`);
    } catch {
      setLocation("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  // ── Section labels ──────────────────────────────────────────────────────────

  const sectionLabel: Partial<Record<StepId, string>> = {
    welcome: "",
    education: "Professional Profile",
    experience: "Professional Profile",
    primary_goal: "Your Goal",
    industry: "Interview Context",
    company: "Target Company",
    role: "Target Role",
    interview_confirmed: "Interview Timeline",
    interview_detail: "Interview Timeline",
    environment: "Professional Context",
    current_role: "Professional Context",
    high_stakes: "Your Priorities",
    emotional_connect: "Welcome",
    privacy_trust: "Your Space",
    how_it_works: "How It Works",
    baseline: "Almost There",
  };

  const isMetaStep = META_STEPS.includes(currentStep);
  const isWelcomeStep = currentStep === "welcome";
  const progressPct = isMetaStep ? 100 : (displayIndex / displayTotal) * 100;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#FBF7F2" }}>

      {/* Progress bar — hidden on welcome */}
      {!isWelcomeStep && (
        <div className="h-0.5 w-full" style={{ backgroundColor: "#0F1B2D10" }}>
          <div
            className="h-full transition-all duration-500 ease-out"
            style={{ width: `${progressPct}%`, backgroundColor: "#F0953E" }}
          />
        </div>
      )}

      {/* Step counter — hidden on welcome */}
      {!isWelcomeStep && (
        <div className="flex items-center justify-between px-6 pt-5 pb-2">
          <p className="text-xs tracking-widest uppercase" style={{ fontFamily: "'DM Mono', monospace", color: "#0F1B2D40" }}>
            {sectionLabel[currentStep]}
          </p>
          {!isMetaStep && (
            <p className="text-xs tabular-nums" style={{ fontFamily: "'DM Mono', monospace", color: "#0F1B2D35" }}>
              {displayIndex} / {displayTotal}
            </p>
          )}
        </div>
      )}

      {/* Content */}
      <div className={`flex-1 flex ${isWelcomeStep ? "items-center" : "items-start"} justify-center px-5 py-4`}>
        <div className="w-full max-w-lg">

          {/* ── STEP: welcome ──────────────────────────────────────────────── */}
          {currentStep === "welcome" && (
            <div className="space-y-8 text-center">
              {/* Logo */}
              <div className="flex items-center justify-center gap-2.5">
                <img src="/gravitas-logo-light.png" alt="Gravitas" className="h-9 w-auto" />
                <span
                  className="text-3xl font-semibold"
                  style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: "#0F1B2D" }}
                >
                  Gravitas
                </span>
              </div>

              {/* Headline */}
              <div className="space-y-3">
                <h1
                  className="text-4xl font-semibold leading-tight"
                  style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: "#0F1B2D" }}
                >
                  Let's get to know you.
                </h1>
                <p className="text-base leading-relaxed" style={{ color: "#0F1B2D70" }}>
                  This will help us personalise your coaching so you make the most of Gravitas from day one.
                </p>
              </div>

              {/* What to expect */}
              <div
                className="rounded-2xl px-6 py-5 text-left space-y-3.5"
                style={{ backgroundColor: "white", border: "2px solid #0F1B2D08" }}
              >
                <p className="text-xs tracking-widest uppercase" style={{ fontFamily: "'DM Mono', monospace", color: "#F0953E" }}>
                  What to expect
                </p>
                {[
                  { icon: "⏱", text: "Takes about 2 minutes" },
                  { icon: "💬", text: "A few quick questions about your goals and context" },
                  { icon: "✨", text: "Your experience is tailored to your answers from the start" },
                ].map(({ icon, text }) => (
                  <div key={text} className="flex items-start gap-3">
                    <span className="text-base leading-snug flex-shrink-0">{icon}</span>
                    <p className="text-sm leading-snug" style={{ color: "#0F1B2D75" }}>{text}</p>
                  </div>
                ))}
              </div>

              {/* CTA */}
              <ContinueButton onClick={() => setCurrentStep("experience")} label="Let's begin →" />
            </div>
          )}

          {/* ── STEP: education ────────────────────────────────────────────── */}
          {currentStep === "education" && (
            <div className="space-y-5">
              <div className="flex items-center gap-3 mb-1">
                <BackButton onClick={goBack} />
              </div>
              <div>
                <h1 className="text-3xl font-semibold leading-tight" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: "#0F1B2D" }}>
                  What is your highest level of education?
                </h1>
              </div>
              <div className="space-y-2">
                {EDUCATION_LEVELS.map(e => (
                  <OptionCard
                    key={e.id}
                    label={e.label}
                    selected={educationLevel === e.id}
                    onClick={() => selectAndAdvance(setEducationLevel, e.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ── STEP: experience ───────────────────────────────────────────── */}
          {currentStep === "experience" && (
            <div className="space-y-5">
              <div className="flex items-center gap-3 mb-1">
                <BackButton onClick={() => setCurrentStep("welcome")} />
              </div>
              <div>
                <h1 className="text-3xl font-semibold leading-tight" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: "#0F1B2D" }}>
                  How many years of full-time work experience do you have?
                </h1>
              </div>
              <div className="space-y-2">
                {EXPERIENCE_YEARS.map(e => (
                  <OptionCard
                    key={e.id}
                    label={e.label}
                    selected={workExperienceYears === e.id}
                    onClick={() => selectAndAdvance(setWorkExperienceYears, e.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ── STEP: primary_goal ─────────────────────────────────────────── */}
          {currentStep === "primary_goal" && (
            <div className="space-y-5">
              <div className="flex items-center gap-3 mb-1">
                <BackButton onClick={goBack} />
              </div>
              <div>
                <h1 className="text-3xl font-semibold leading-tight" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: "#0F1B2D" }}>
                  What brings you to Gravitas today?
                </h1>
                <p className="mt-2 text-sm" style={{ color: "#0F1B2D60" }}>
                  We'll personalise your entire experience around your answer.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-3">
                <button
                  onClick={() => setPrimaryGoalAndAdvance("workplace_presence")}
                  className="w-full text-left rounded-2xl border-2 p-6 transition-all duration-150 border-[#0F1B2D]/12 bg-white hover:border-[#F0953E]/60 hover:bg-[#F0953E]/4"
                >
                  <p className="text-base font-semibold" style={{ color: "#0F1B2D" }}>
                    I want to improve how I show up at work
                  </p>
                  <p className="text-sm mt-1" style={{ color: "#0F1B2D55" }}>
                    Build the presence that matches your capability.
                  </p>
                </button>
                <button
                  onClick={() => setPrimaryGoalAndAdvance("interview_prep")}
                  className="w-full text-left rounded-2xl border-2 p-6 transition-all duration-150 border-[#0F1B2D]/12 bg-white hover:border-[#F0953E]/60 hover:bg-[#F0953E]/4"
                >
                  <p className="text-base font-semibold" style={{ color: "#0F1B2D" }}>
                    I have an interview coming up
                  </p>
                  <p className="text-sm mt-1" style={{ color: "#0F1B2D55" }}>
                    Show up with the presence that matches your preparation.
                  </p>
                </button>
              </div>
            </div>
          )}

          {/* ── STEP: industry (Interview) ─────────────────────────────────── */}
          {currentStep === "industry" && (
            <div className="space-y-5">
              <div className="flex items-center gap-3 mb-1">
                <BackButton onClick={goBack} />
              </div>
              <div>
                <h1 className="text-3xl font-semibold leading-tight" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: "#0F1B2D" }}>
                  Which industry is your interview for?
                </h1>
              </div>
              <div className="space-y-2">
                {INDUSTRIES.map(ind => (
                  <OptionCard
                    key={ind.id}
                    label={ind.label}
                    selected={industry === ind.id}
                    onClick={() => {
                      if (ind.id !== "other") {
                        setIndustryCustom("");
                        selectAndAdvance(setIndustry, ind.id);
                      } else {
                        setIndustry("other");
                      }
                    }}
                  />
                ))}
              </div>
              {industry === "other" && (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={industryCustom}
                    onChange={(e) => setIndustryCustom(e.target.value)}
                    placeholder="e.g. Healthcare, Real Estate, Legal"
                    autoFocus
                    className="w-full rounded-xl border-2 px-4 py-3 text-sm focus:outline-none transition-colors"
                    style={{ borderColor: industryCustom ? "#F0953E" : "#0F1B2D15", backgroundColor: "white", color: "#0F1B2D" }}
                  />
                  <ContinueButton onClick={goNext} disabled={!industryCustom.trim()} />
                </div>
              )}
            </div>
          )}

          {/* ── STEP: company (Interview) ──────────────────────────────────── */}
          {currentStep === "company" && (
            <div className="space-y-5">
              <div className="flex items-center gap-3 mb-1">
                <BackButton onClick={goBack} />
              </div>
              <div>
                <h1 className="text-3xl font-semibold leading-tight" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: "#0F1B2D" }}>
                  Which company are you interviewing with?
                </h1>
                <p className="mt-2 text-sm" style={{ color: "#0F1B2D60" }}>
                  Select all that apply, or skip if you're not sure yet.
                </p>
              </div>
              {industry !== "other" && (COMPANIES_BY_INDUSTRY[industry] ?? []).length > 0 && (
                <div className="space-y-2">
                  {(COMPANIES_BY_INDUSTRY[industry] ?? []).map(company => (
                    <CheckCard
                      key={company}
                      label={company}
                      selected={selectedCompanies.includes(company)}
                      onClick={() => toggleCompany(company)}
                    />
                  ))}
                </div>
              )}
              <div>
                <p className="text-xs mb-2" style={{ color: "#0F1B2D45" }}>
                  {industry !== "other" ? "Add another company:" : "Which company?"}
                </p>
                <input
                  type="text"
                  value={companyCustom}
                  onChange={(e) => setCompanyCustom(e.target.value)}
                  placeholder="e.g. Bridgewater Associates"
                  className="w-full rounded-xl border-2 px-4 py-3 text-sm focus:outline-none transition-colors"
                  style={{ borderColor: companyCustom ? "#F0953E" : "#0F1B2D15", backgroundColor: "white", color: "#0F1B2D" }}
                />
              </div>
              <ContinueButton
                onClick={goNext}
                label={selectedCompanies.length === 0 && !companyCustom.trim() ? "Skip" : "Continue"}
              />
            </div>
          )}

          {/* ── STEP: role (Interview) — text entry only ───────────────────── */}
          {currentStep === "role" && (
            <div className="space-y-5">
              <div className="flex items-center gap-3 mb-1">
                <BackButton onClick={goBack} />
              </div>
              <div>
                <h1 className="text-3xl font-semibold leading-tight" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: "#0F1B2D" }}>
                  Which role are you interviewing for?
                </h1>
              </div>
              <input
                type="text"
                value={interviewRole}
                onChange={(e) => setInterviewRole(e.target.value)}
                placeholder="e.g. Associate Consultant, Product Manager"
                autoFocus
                className="w-full rounded-xl border-2 px-4 py-3.5 text-sm focus:outline-none transition-colors"
                style={{ borderColor: interviewRole ? "#F0953E" : "#0F1B2D15", backgroundColor: "white", color: "#0F1B2D" }}
                onKeyDown={(e) => { if (e.key === "Enter" && interviewRole.trim()) goNext(); }}
              />
              <ContinueButton onClick={goNext} disabled={!interviewRole.trim()} />
            </div>
          )}

          {/* ── STEP: interview_confirmed ──────────────────────────────────── */}
          {currentStep === "interview_confirmed" && (
            <div className="space-y-5">
              <div className="flex items-center gap-3 mb-1">
                <BackButton onClick={goBack} />
              </div>
              <div>
                <h1 className="text-3xl font-semibold leading-tight" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: "#0F1B2D" }}>
                  Do you have a confirmed interview date?
                </h1>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => { setHasConfirmedInterview(true); goNext(); }}
                  className="rounded-2xl border-2 py-6 text-sm font-semibold transition-all duration-150 border-[#0F1B2D]/12 bg-white text-[#0F1B2D]/70 hover:border-[#F0953E]/50 hover:bg-[#F0953E]/4"
                >
                  Yes
                </button>
                <button
                  onClick={() => { setHasConfirmedInterview(false); goNext(); }}
                  className="rounded-2xl border-2 py-6 text-sm font-semibold transition-all duration-150 border-[#0F1B2D]/12 bg-white text-[#0F1B2D]/70 hover:border-[#F0953E]/50 hover:bg-[#F0953E]/4"
                >
                  Not yet
                </button>
              </div>
            </div>
          )}

          {/* ── STEP: interview_detail (confirmed = true) ──────────────────── */}
          {currentStep === "interview_detail" && hasConfirmedInterview && (
            <div className="space-y-5">
              <div className="flex items-center gap-3 mb-1">
                <BackButton onClick={goBack} />
              </div>
              <div>
                <h1 className="text-3xl font-semibold leading-tight" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: "#0F1B2D" }}>
                  When is your interview?
                </h1>
              </div>
              <input
                type="date"
                value={interviewDate}
                min={new Date().toISOString().split("T")[0]}
                onChange={(e) => setInterviewDate(e.target.value)}
                className="w-full rounded-xl border-2 px-4 py-3 text-sm focus:outline-none transition-colors"
                style={{ borderColor: interviewDate ? "#F0953E" : "#0F1B2D15", backgroundColor: "white", color: "#0F1B2D" }}
              />
              <ContinueButton onClick={goNext} disabled={!interviewDate} />
            </div>
          )}

          {/* ── STEP: interview_detail (confirmed = false) ─────────────────── */}
          {currentStep === "interview_detail" && hasConfirmedInterview === false && (
            <div className="space-y-5">
              <div className="flex items-center gap-3 mb-1">
                <BackButton onClick={goBack} />
              </div>
              <div>
                <h1 className="text-3xl font-semibold leading-tight" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: "#0F1B2D" }}>
                  When is your interview?
                </h1>
              </div>
              <div className="space-y-2">
                {INTERVIEW_TIMELINES.map(t => (
                  <OptionCard
                    key={t}
                    label={t}
                    selected={interviewTimeline === t}
                    onClick={() => selectAndAdvance(setInterviewTimeline, t)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ── STEP: environment (Workplace) ──────────────────────────────── */}
          {currentStep === "environment" && (
            <div className="space-y-5">
              <div className="flex items-center gap-3 mb-1">
                <BackButton onClick={goBack} />
              </div>
              <div>
                <h1 className="text-3xl font-semibold leading-tight" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: "#0F1B2D" }}>
                  Which environment best reflects your current work?
                </h1>
              </div>
              <div className="space-y-2">
                {WORK_ENVIRONMENTS.map(env => (
                  <OptionCard
                    key={env.id}
                    label={env.label}
                    selected={workEnvironment === env.id}
                    onClick={() => {
                      if (env.id !== "other") {
                        setWorkEnvironmentCustom("");
                        selectAndAdvance(setWorkEnvironment, env.id);
                      } else {
                        setWorkEnvironment("other");
                      }
                    }}
                  />
                ))}
              </div>
              {workEnvironment === "other" && (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={workEnvironmentCustom}
                    onChange={(e) => setWorkEnvironmentCustom(e.target.value)}
                    placeholder="Describe your work environment"
                    autoFocus
                    className="w-full rounded-xl border-2 px-4 py-3 text-sm focus:outline-none transition-colors"
                    style={{ borderColor: workEnvironmentCustom ? "#F0953E" : "#0F1B2D15", backgroundColor: "white", color: "#0F1B2D" }}
                  />
                  <ContinueButton onClick={goNext} disabled={!workEnvironmentCustom.trim()} />
                </div>
              )}
            </div>
          )}

          {/* ── STEP: current_role (Workplace) ─────────────────────────────── */}
          {currentStep === "current_role" && (
            <div className="space-y-5">
              <div className="flex items-center gap-3 mb-1">
                <BackButton onClick={goBack} />
              </div>
              <div>
                <h1 className="text-3xl font-semibold leading-tight" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: "#0F1B2D" }}>
                  Which best describes your current role?
                </h1>
              </div>
              <div className="space-y-2">
                {WORKPLACE_ROLES.map(role => (
                  <OptionCard
                    key={role}
                    label={role}
                    selected={workCurrentRole === role}
                    onClick={() => {
                      if (role !== "Other") {
                        setWorkCurrentRoleCustom("");
                        selectAndAdvance(setWorkCurrentRole, role);
                      } else {
                        setWorkCurrentRole("Other");
                      }
                    }}
                  />
                ))}
              </div>
              {workCurrentRole === "Other" && (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={workCurrentRoleCustom}
                    onChange={(e) => setWorkCurrentRoleCustom(e.target.value)}
                    placeholder="Describe your role"
                    autoFocus
                    className="w-full rounded-xl border-2 px-4 py-3 text-sm focus:outline-none transition-colors"
                    style={{ borderColor: workCurrentRoleCustom ? "#F0953E" : "#0F1B2D15", backgroundColor: "white", color: "#0F1B2D" }}
                  />
                  <ContinueButton onClick={goNext} disabled={!workCurrentRoleCustom.trim()} />
                </div>
              )}
            </div>
          )}

          {/* ── STEP: high_stakes (Workplace) ──────────────────────────────── */}
          {currentStep === "high_stakes" && (
            <div className="space-y-5">
              <div className="flex items-center gap-3 mb-1">
                <BackButton onClick={goBack} />
              </div>
              <div>
                <h1 className="text-3xl font-semibold leading-tight" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: "#0F1B2D" }}>
                  Where does executive presence matter most for you?
                </h1>
                <p className="mt-2 text-sm" style={{ color: "#0F1B2D60" }}>Select all that apply.</p>
              </div>
              <div className="space-y-2">
                {HIGH_STAKES_CONTEXTS.map(ctx => (
                  <CheckCard
                    key={ctx}
                    label={ctx}
                    selected={highStakesContexts.includes(ctx)}
                    onClick={() => toggleContext(ctx)}
                  />
                ))}
              </div>
              <ContinueButton onClick={goNext} disabled={highStakesContexts.length === 0} />
            </div>
          )}

          {/* ── STEP: emotional_connect ────────────────────────────────────── */}
          {currentStep === "emotional_connect" && (
            <div className="space-y-8 flex flex-col min-h-[70vh] justify-center">
              <div className="flex items-center gap-3 mb-1">
                <BackButton onClick={goBack} />
              </div>
              <div>
                <h1
                  className="text-4xl font-semibold leading-tight mb-5"
                  style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: "#0F1B2D" }}
                >
                  You showed up.<br />That already sets you apart.
                </h1>
                <div className="h-px w-12 mb-5" style={{ backgroundColor: "#F0953E" }} />
                <p className="text-base leading-relaxed" style={{ color: "#0F1B2D", opacity: 0.65 }}>
                  Most people never find out how they truly come across.
                </p>
                <p className="text-base leading-relaxed mt-3" style={{ color: "#0F1B2D", opacity: 0.65 }}>
                  You are about to.
                </p>
                <p className="text-base leading-relaxed mt-3" style={{ color: "#0F1B2D", opacity: 0.65 }}>
                  Gravitas gives you a specific, honest picture of how you land — in the rooms and moments that matter most.
                </p>
              </div>
              <ContinueButton onClick={goNext} label="Next" />
            </div>
          )}

          {/* ── STEP: privacy_trust ─────────────────────────────────────────── */}
          {currentStep === "privacy_trust" && (
            <div className="space-y-8 flex flex-col min-h-[70vh] justify-center">
              <div className="flex items-center gap-3 mb-1">
                <BackButton onClick={goBack} />
              </div>
              <div>
                <h1
                  className="text-4xl font-semibold leading-tight mb-5"
                  style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: "#0F1B2D" }}
                >
                  This is your space.<br />Completely.
                </h1>
                <div className="h-px w-12 mb-5" style={{ backgroundColor: "#F0953E" }} />
                <p className="text-base leading-relaxed" style={{ color: "#0F1B2D", opacity: 0.65 }}>
                  Your recordings are never stored, never shared, and never seen by anyone — including us.
                </p>
                <p className="text-base leading-relaxed mt-3" style={{ color: "#0F1B2D", opacity: 0.65 }}>
                  What happens here stays here. It is how we built it.
                </p>
                <p className="text-base leading-relaxed mt-3" style={{ color: "#0F1B2D", opacity: 0.65 }}>
                  Record freely. Be unpolished. Make mistakes. Say the thing you are still figuring out. That is exactly how this tool works best.
                </p>
                <p className="text-base leading-relaxed mt-3" style={{ color: "#0F1B2D", opacity: 0.65 }}>
                  You can record audio only or add video. It's your choice, every time.
                </p>
              </div>
              <ContinueButton onClick={goNext} label="Got it →" />
            </div>
          )}

          {/* ── STEP: how_it_works ──────────────────────────────────────────── */}
          {currentStep === "how_it_works" && (
            <div className="space-y-7 flex flex-col min-h-[70vh] justify-center">
              <div className="flex items-center gap-3 mb-1">
                <BackButton onClick={goBack} />
              </div>
              <div>
                <h1
                  className="text-4xl font-semibold leading-tight"
                  style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: "#0F1B2D" }}
                >
                  What Gravitas measures.
                </h1>
                <p className="mt-2 text-sm" style={{ color: "#0F1B2D60" }}>
                  Four pillars. 15 dimensions. One honest score.
                </p>
              </div>

              <div className="space-y-3">
                {[
                  {
                    num: "01",
                    title: "Thought Clarity",
                    body: "Whether your thinking lands sharp and decisive, or leaves the listener doing the work.",
                  },
                  {
                    num: "02",
                    title: "Vocal Delivery",
                    body: "The pace, pauses, and rhythm that signal confidence or anxiety.",
                  },
                  {
                    num: "03",
                    title: "Voice Quality",
                    body: "Whether your voice carries authority and steadiness.",
                  },
                  {
                    num: "04",
                    title: "Physical Delivery",
                    body: "What the room sees — posture, eye contact, expression, gesture.",
                    note: "Video only",
                  },
                ].map((pillar) => (
                  <div
                    key={pillar.num}
                    className="rounded-2xl px-5 py-4"
                    style={{ backgroundColor: "white", border: "2px solid #0F1B2D08" }}
                  >
                    <div className="flex items-start gap-4">
                      <span
                        className="text-xs tabular-nums mt-0.5 flex-shrink-0"
                        style={{ fontFamily: "'DM Mono', monospace", color: "#F0953E" }}
                      >
                        {pillar.num}
                      </span>
                      <div>
                        <p className="text-sm font-semibold" style={{ color: "#0F1B2D" }}>
                          {pillar.title}
                          {pillar.note && (
                            <span
                              className="ml-2 text-[10px] font-normal px-1.5 py-0.5 rounded-full"
                              style={{ backgroundColor: "#0F1B2D08", color: "#0F1B2D50", fontFamily: "'DM Mono', monospace" }}
                            >
                              {pillar.note}
                            </span>
                          )}
                        </p>
                        <p className="text-xs leading-relaxed mt-1" style={{ color: "#0F1B2D60" }}>
                          {pillar.body}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <ContinueButton onClick={save} disabled={loading} label={loading ? "Saving your profile…" : "Start my baseline →"} />
            </div>
          )}

          {/* ── STEP: baseline ─────────────────────────────────────────────── */}
          {currentStep === "baseline" && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-1">
                <BackButton onClick={goBack} />
              </div>
              <div>
                <p className="text-xs tracking-widest uppercase mb-3" style={{ fontFamily: "'DM Mono', monospace", color: "#F0953E" }}>
                  Final step
                </p>
                <h1 className="text-4xl font-semibold leading-tight" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: "#0F1B2D" }}>
                  Your baseline recording.
                </h1>
                <p className="mt-3 text-sm leading-relaxed" style={{ color: "#0F1B2D65" }}>
                  Before your first coached session, we capture a short baseline — a snapshot of where you are today. It takes 1–2 minutes and gives us everything we need to personalise your coaching from day one.
                </p>
              </div>

              <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: "#0F1B2D" }}>
                <div className="h-0.5 w-full" style={{ background: "linear-gradient(to right, #F0953E, #C84A18)" }} />
                <div className="px-6 py-6">
                  <p className="text-xs uppercase tracking-widest mb-3" style={{ fontFamily: "'DM Mono', monospace", color: "rgba(255,255,255,0.35)" }}>
                    Your baseline prompt
                  </p>
                  <p className="text-[1.35rem] font-semibold leading-snug" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: "white" }}>
                    {path === "interview" ? BASELINE_PROMPTS.interview.prompt : BASELINE_PROMPTS.workplace.prompt}
                  </p>
                  <p className="mt-4 text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
                    1–2 minutes recommended
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <ContinueButton onClick={save} disabled={loading} label={loading ? "Saving your profile…" : "Begin Baseline Recording"} />
              </div>

              <p className="text-xs text-center" style={{ color: "#0F1B2D35" }}>
                You can always record more sessions after completing your baseline.
              </p>
            </div>
          )}

        </div>
      </div>

      <div className="h-8" />
    </div>
  );
}
