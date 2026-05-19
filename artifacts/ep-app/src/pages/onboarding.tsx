import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";

const BASELINE_PROMPT =
  "Tell us about yourself, your professional background, and what brought you here.";

// ── Data constants ────────────────────────────────────────────────────────────

const CAREER_STAGES = [
  { id: "undergraduate", label: "Undergraduate Student" },
  { id: "masters_mba", label: "Master's / MBA Student" },
  { id: "early_career", label: "Early Career Professional", sub: "0–3 years" },
  { id: "mid_level", label: "Mid-Level Professional", sub: "4–8 years" },
  { id: "senior", label: "Senior Professional", sub: "9–15 years" },
  { id: "executive", label: "Executive / Leadership", sub: "15+ years" },
];

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

const ROLES_BY_INDUSTRY: Record<string, string[]> = {
  consulting: ["Business Analyst / Associate", "Consultant", "Engagement Manager", "Associate Partner / Partner", "Other"],
  banking: ["Analyst", "Associate", "VP / Director", "Investment Banking", "Asset Management", "Other"],
  technology: ["Product Manager", "Strategy & Operations", "Program Manager", "Leadership Role", "Technical Role", "Other"],
  other: ["Other"],
};

const INTERVIEW_STAGES = [
  "Actively applying",
  "Recruiter Screen",
  "First Round",
  "Final Round",
  "Prefer not to say",
];

const INTERVIEW_TIMELINES = [
  "Interview within 2 weeks",
  "Interview within 1 month",
  "Interview within 3 months",
  "Exploring opportunities",
  "General preparation",
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

const SELF_ASSESSMENT_DIMS = [
  {
    key: "thoughtClarity" as const,
    label: "Thought Clarity",
    description: "How clearly and confidently you organize and express your thinking.",
  },
  {
    key: "vocalDelivery" as const,
    label: "Vocal Delivery",
    description: "How effectively you use pace, pauses, and vocal variation to communicate presence.",
  },
  {
    key: "voiceQuality" as const,
    label: "Voice Quality",
    description: "How grounded, steady, and authoritative your voice sounds to others.",
  },
  {
    key: "physicalDelivery" as const,
    label: "Physical Delivery",
    description: "How your body language and nonverbal presence support your message.",
  },
];

// ── Step definitions ──────────────────────────────────────────────────────────

type StepId =
  | "career_stage" | "education" | "experience" | "primary_goal"
  | "industry" | "company" | "role" | "interview_confirmed" | "interview_detail"
  | "environment" | "current_role" | "high_stakes"
  | "self_assessment" | "baseline";

type Path = "interview" | "workplace" | null;

function getStepList(path: Path): StepId[] {
  const common: StepId[] = ["career_stage", "education", "experience", "primary_goal"];
  if (path === "interview") {
    return [...common, "industry", "company", "role", "interview_confirmed", "interview_detail", "self_assessment", "baseline"];
  }
  if (path === "workplace") {
    return [...common, "environment", "current_role", "high_stakes", "self_assessment", "baseline"];
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
          {sub && (
            <p className="text-xs text-[#0F1B2D]/45 mt-0.5">{sub}</p>
          )}
        </div>
        <div
          className={`h-4 w-4 flex-shrink-0 rounded-full border-2 flex items-center justify-center transition-all ${
            selected ? "border-[#F0953E] bg-[#F0953E]" : "border-[#0F1B2D]/20"
          }`}
        >
          {selected && (
            <div className="h-1.5 w-1.5 rounded-full bg-white" />
          )}
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
            <svg viewBox="0 0 10 10" className="h-2.5 w-2.5 text-white fill-none stroke-white stroke-[1.8]">
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

function SliderRow({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <div>
          <p className="text-sm font-semibold text-[#0F1B2D]">{label}</p>
          <p className="text-xs text-[#0F1B2D]/50 mt-0.5">{description}</p>
        </div>
        <span
          className="text-lg font-bold tabular-nums ml-4 flex-shrink-0"
          style={{ fontFamily: "'DM Mono', monospace", color: "#F0953E" }}
        >
          {value}
        </span>
      </div>
      <div className="relative">
        <input
          type="range"
          min={1}
          max={10}
          step={1}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
          style={{
            background: `linear-gradient(to right, #F0953E ${((value - 1) / 9) * 100}%, #0F1B2D15 ${((value - 1) / 9) * 100}%)`,
          }}
        />
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-[#0F1B2D]/35">1</span>
          <span className="text-[10px] text-[#0F1B2D]/35">10</span>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const { refreshUser } = useAuth();
  const [, setLocation] = useLocation();

  const [currentStep, setCurrentStep] = useState<StepId>("career_stage");
  const [path, setPath] = useState<Path>(null);
  const [loading, setLoading] = useState(false);

  // Professional profile
  const [careerStage, setCareerStage] = useState("");
  const [educationLevel, setEducationLevel] = useState("");
  const [workExperienceYears, setWorkExperienceYears] = useState("");

  // Interview path
  const [industry, setIndustry] = useState("");
  const [industryCustom, setIndustryCustom] = useState("");
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);
  const [companyCustom, setCompanyCustom] = useState("");
  const [interviewRole, setInterviewRole] = useState("");
  const [interviewRoleCustom, setInterviewRoleCustom] = useState("");
  const [hasConfirmedInterview, setHasConfirmedInterview] = useState<boolean | null>(null);
  const [interviewDate, setInterviewDate] = useState("");
  const [interviewStage, setInterviewStage] = useState("");
  const [interviewTimeline, setInterviewTimeline] = useState("");

  // Workplace path
  const [workEnvironment, setWorkEnvironment] = useState("");
  const [workEnvironmentCustom, setWorkEnvironmentCustom] = useState("");
  const [workCurrentRole, setWorkCurrentRole] = useState("");
  const [workCurrentRoleCustom, setWorkCurrentRoleCustom] = useState("");
  const [highStakesContexts, setHighStakesContexts] = useState<string[]>([]);

  // Self-assessment
  const [selfAssessment, setSelfAssessment] = useState({
    thoughtClarity: 5,
    vocalDelivery: 5,
    voiceQuality: 5,
    physicalDelivery: 5,
  });

  // ── Step navigation helpers ─────────────────────────────────────────────────

  const steps = getStepList(path);
  const currentIndex = steps.indexOf(currentStep);
  const totalSteps = path === null ? steps.length + 7 : steps.length;
  const displayTotal = path === "interview" ? 11 : path === "workplace" ? 9 : 11;
  const displayIndex = currentIndex + 1;

  const goNext = () => {
    const nextIdx = currentIndex + 1;
    if (nextIdx < steps.length) {
      setCurrentStep(steps[nextIdx]);
    }
  };

  const goBack = () => {
    const prevIdx = currentIndex - 1;
    if (prevIdx >= 0) {
      setCurrentStep(steps[prevIdx]);
    }
  };

  const setPrimaryGoalAndPath = (goal: "interview_prep" | "workplace_presence") => {
    setPath(goal === "interview_prep" ? "interview" : "workplace");
    const newSteps = getStepList(goal === "interview_prep" ? "interview" : "workplace");
    const nextStep = newSteps[newSteps.indexOf("primary_goal") + 1];
    setCurrentStep(nextStep);
  };

  const toggleCompany = (c: string) =>
    setSelectedCompanies(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);

  const toggleContext = (c: string) =>
    setHighStakesContexts(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);

  // ── Save + navigate to baseline ─────────────────────────────────────────────

  const save = async () => {
    setLoading(true);
    try {
      const companies = [...selectedCompanies];
      if (companyCustom.trim()) companies.push(companyCustom.trim());

      await api.users.completeOnboarding({
        primaryGoal: path === "interview" ? "interview_prep" : "workplace_presence",
        careerStage: careerStage || null,
        educationLevel: educationLevel || null,
        workExperienceYears: workExperienceYears || null,
        interviewMode: path === "interview",
        interviewSector: path === "interview" ? (industry || null) : null,
        interviewSectorCustom: path === "interview" && industry === "other" ? (industryCustom.trim() || null) : null,
        interviewCompanies: path === "interview" && companies.length > 0 ? companies.join("; ") : null,
        interviewRole: path === "interview" ? (interviewRole || null) : null,
        interviewRoleCustom: path === "interview" && interviewRole === "Other" ? (interviewRoleCustom.trim() || null) : null,
        hasConfirmedInterview: path === "interview" ? hasConfirmedInterview : null,
        interviewDate: path === "interview" && hasConfirmedInterview ? (interviewDate || null) : null,
        interviewStage: path === "interview" && hasConfirmedInterview ? (interviewStage || null) : null,
        interviewTimeline: path === "interview" && !hasConfirmedInterview ? (interviewTimeline || null) : null,
        workEnvironment: path === "workplace" ? (workEnvironment || null) : null,
        workCurrentRole: path === "workplace" ? (workCurrentRole || null) : null,
        workCurrentRoleCustom: path === "workplace" && workCurrentRole === "Other" ? (workCurrentRoleCustom.trim() || null) : null,
        highStakesContexts: path === "workplace" && highStakesContexts.length > 0 ? highStakesContexts.join("; ") : null,
        selfAssessmentThoughtClarity: selfAssessment.thoughtClarity,
        selfAssessmentVocalDelivery: selfAssessment.vocalDelivery,
        selfAssessmentVoiceQuality: selfAssessment.voiceQuality,
        selfAssessmentPhysicalDelivery: selfAssessment.physicalDelivery,
      });
      await refreshUser();
      setLocation(`/record?baseline=1&prompt=${encodeURIComponent(BASELINE_PROMPT)}`);
    } catch {
      setLocation("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  // ── Section labels ──────────────────────────────────────────────────────────

  const sectionLabel: Partial<Record<StepId, string>> = {
    career_stage: "Professional Profile",
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
    self_assessment: "Self Assessment",
    baseline: "Almost There",
  };

  // ── Progress bar ────────────────────────────────────────────────────────────

  const progressPct = displayIndex / displayTotal * 100;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#FBF7F2" }}>

      {/* Top progress bar */}
      <div className="h-0.5 w-full" style={{ backgroundColor: "#0F1B2D10" }}>
        <div
          className="h-full transition-all duration-500 ease-out"
          style={{ width: `${progressPct}%`, backgroundColor: "#F0953E" }}
        />
      </div>

      {/* Step counter */}
      <div className="flex items-center justify-between px-6 pt-5 pb-2">
        <p
          className="text-xs tracking-widest uppercase"
          style={{ fontFamily: "'DM Mono', monospace", color: "#0F1B2D40" }}
        >
          {sectionLabel[currentStep]}
        </p>
        <p
          className="text-xs tabular-nums"
          style={{ fontFamily: "'DM Mono', monospace", color: "#0F1B2D35" }}
        >
          {displayIndex} / {displayTotal}
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-start justify-center px-5 py-4">
        <div className="w-full max-w-lg">

          {/* ── STEP: career_stage ─────────────────────────────────────────── */}
          {currentStep === "career_stage" && (
            <div className="space-y-6">
              <div>
                <h1
                  className="text-3xl font-semibold leading-tight"
                  style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: "#0F1B2D" }}
                >
                  Which best describes your current stage?
                </h1>
                <p className="mt-2 text-sm" style={{ color: "#0F1B2D60" }}>
                  This helps us tailor your coaching to where you are in your career.
                </p>
              </div>
              <div className="space-y-2">
                {CAREER_STAGES.map(s => (
                  <OptionCard
                    key={s.id}
                    label={s.label}
                    sub={s.sub}
                    selected={careerStage === s.id}
                    onClick={() => setCareerStage(s.id)}
                  />
                ))}
              </div>
              <button
                onClick={goNext}
                disabled={!careerStage}
                className="w-full rounded-xl py-3.5 text-sm font-semibold text-white transition-all duration-150 disabled:opacity-40"
                style={{ backgroundColor: "#F0953E" }}
              >
                Continue
              </button>
            </div>
          )}

          {/* ── STEP: education ────────────────────────────────────────────── */}
          {currentStep === "education" && (
            <div className="space-y-6">
              <div>
                <h1
                  className="text-3xl font-semibold leading-tight"
                  style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: "#0F1B2D" }}
                >
                  What is your highest level of education?
                </h1>
              </div>
              <div className="space-y-2">
                {EDUCATION_LEVELS.map(e => (
                  <OptionCard
                    key={e.id}
                    label={e.label}
                    selected={educationLevel === e.id}
                    onClick={() => setEducationLevel(e.id)}
                  />
                ))}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={goBack}
                  className="flex-1 rounded-xl py-3.5 text-sm font-semibold border-2 transition-all duration-150"
                  style={{ borderColor: "#0F1B2D15", color: "#0F1B2D60" }}
                >
                  Back
                </button>
                <button
                  onClick={goNext}
                  disabled={!educationLevel}
                  className="flex-[2] rounded-xl py-3.5 text-sm font-semibold text-white transition-all duration-150 disabled:opacity-40"
                  style={{ backgroundColor: "#F0953E" }}
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* ── STEP: experience ───────────────────────────────────────────── */}
          {currentStep === "experience" && (
            <div className="space-y-6">
              <div>
                <h1
                  className="text-3xl font-semibold leading-tight"
                  style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: "#0F1B2D" }}
                >
                  How many years of full-time work experience do you have?
                </h1>
              </div>
              <div className="space-y-2">
                {EXPERIENCE_YEARS.map(e => (
                  <OptionCard
                    key={e.id}
                    label={e.label}
                    selected={workExperienceYears === e.id}
                    onClick={() => setWorkExperienceYears(e.id)}
                  />
                ))}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={goBack}
                  className="flex-1 rounded-xl py-3.5 text-sm font-semibold border-2 transition-all duration-150"
                  style={{ borderColor: "#0F1B2D15", color: "#0F1B2D60" }}
                >
                  Back
                </button>
                <button
                  onClick={goNext}
                  disabled={!workExperienceYears}
                  className="flex-[2] rounded-xl py-3.5 text-sm font-semibold text-white transition-all duration-150 disabled:opacity-40"
                  style={{ backgroundColor: "#F0953E" }}
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* ── STEP: primary_goal ─────────────────────────────────────────── */}
          {currentStep === "primary_goal" && (
            <div className="space-y-6">
              <div>
                <h1
                  className="text-3xl font-semibold leading-tight"
                  style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: "#0F1B2D" }}
                >
                  Where would you most like to elevate your executive presence?
                </h1>
                <p className="mt-2 text-sm" style={{ color: "#0F1B2D60" }}>
                  We'll personalise your entire experience around your answer.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-3">
                <button
                  onClick={() => setPrimaryGoalAndPath("interview_prep")}
                  className="group w-full text-left rounded-2xl border-2 p-6 transition-all duration-150 border-[#0F1B2D]/12 bg-white hover:border-[#F0953E]/60 hover:bg-[#F0953E]/4"
                >
                  <p className="text-base font-semibold" style={{ color: "#0F1B2D" }}>
                    Interview Preparation
                  </p>
                  <p className="text-sm mt-1" style={{ color: "#0F1B2D55" }}>
                    I'm preparing for a specific interview or role.
                  </p>
                </button>
                <button
                  onClick={() => setPrimaryGoalAndPath("workplace_presence")}
                  className="group w-full text-left rounded-2xl border-2 p-6 transition-all duration-150 border-[#0F1B2D]/12 bg-white hover:border-[#F0953E]/60 hover:bg-[#F0953E]/4"
                >
                  <p className="text-base font-semibold" style={{ color: "#0F1B2D" }}>
                    Workplace Presence
                  </p>
                  <p className="text-sm mt-1" style={{ color: "#0F1B2D55" }}>
                    I want to strengthen my presence in my current role.
                  </p>
                </button>
              </div>
              <button
                onClick={goBack}
                className="w-full rounded-xl py-3 text-sm font-medium border-2 transition-all duration-150"
                style={{ borderColor: "#0F1B2D15", color: "#0F1B2D60" }}
              >
                Back
              </button>
            </div>
          )}

          {/* ── STEP: industry (Interview) ─────────────────────────────────── */}
          {currentStep === "industry" && (
            <div className="space-y-6">
              <div>
                <h1
                  className="text-3xl font-semibold leading-tight"
                  style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: "#0F1B2D" }}
                >
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
                      setIndustry(ind.id);
                      if (ind.id !== "other") setIndustryCustom("");
                    }}
                  />
                ))}
              </div>
              {industry === "other" && (
                <div>
                  <input
                    type="text"
                    value={industryCustom}
                    onChange={(e) => setIndustryCustom(e.target.value)}
                    placeholder="e.g. Healthcare, Real Estate, Legal"
                    autoFocus
                    className="w-full rounded-xl border-2 px-4 py-3 text-sm focus:outline-none transition-colors"
                    style={{
                      borderColor: industryCustom ? "#F0953E" : "#0F1B2D15",
                      backgroundColor: "white",
                      color: "#0F1B2D",
                    }}
                  />
                </div>
              )}
              <div className="flex gap-3">
                <button
                  onClick={goBack}
                  className="flex-1 rounded-xl py-3.5 text-sm font-semibold border-2 transition-all duration-150"
                  style={{ borderColor: "#0F1B2D15", color: "#0F1B2D60" }}
                >
                  Back
                </button>
                <button
                  onClick={goNext}
                  disabled={!industry || (industry === "other" && !industryCustom.trim())}
                  className="flex-[2] rounded-xl py-3.5 text-sm font-semibold text-white transition-all duration-150 disabled:opacity-40"
                  style={{ backgroundColor: "#F0953E" }}
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* ── STEP: company (Interview) ──────────────────────────────────── */}
          {currentStep === "company" && (
            <div className="space-y-6">
              <div>
                <h1
                  className="text-3xl font-semibold leading-tight"
                  style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: "#0F1B2D" }}
                >
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
                  style={{
                    borderColor: companyCustom ? "#F0953E" : "#0F1B2D15",
                    backgroundColor: "white",
                    color: "#0F1B2D",
                  }}
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={goBack}
                  className="flex-1 rounded-xl py-3.5 text-sm font-semibold border-2 transition-all duration-150"
                  style={{ borderColor: "#0F1B2D15", color: "#0F1B2D60" }}
                >
                  Back
                </button>
                <button
                  onClick={goNext}
                  className="flex-[2] rounded-xl py-3.5 text-sm font-semibold text-white transition-all duration-150"
                  style={{ backgroundColor: "#F0953E" }}
                >
                  {selectedCompanies.length === 0 && !companyCustom.trim() ? "Skip" : "Continue"}
                </button>
              </div>
            </div>
          )}

          {/* ── STEP: role (Interview) ─────────────────────────────────────── */}
          {currentStep === "role" && (
            <div className="space-y-6">
              <div>
                <h1
                  className="text-3xl font-semibold leading-tight"
                  style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: "#0F1B2D" }}
                >
                  Which role are you interviewing for?
                </h1>
              </div>
              <div className="space-y-2">
                {(ROLES_BY_INDUSTRY[industry] ?? ROLES_BY_INDUSTRY.other).map(role => (
                  <OptionCard
                    key={role}
                    label={role}
                    selected={interviewRole === role}
                    onClick={() => {
                      setInterviewRole(role);
                      if (role !== "Other") setInterviewRoleCustom("");
                    }}
                  />
                ))}
              </div>
              {interviewRole === "Other" && (
                <div>
                  <input
                    type="text"
                    value={interviewRoleCustom}
                    onChange={(e) => setInterviewRoleCustom(e.target.value)}
                    placeholder="Describe your target role"
                    autoFocus
                    className="w-full rounded-xl border-2 px-4 py-3 text-sm focus:outline-none transition-colors"
                    style={{
                      borderColor: interviewRoleCustom ? "#F0953E" : "#0F1B2D15",
                      backgroundColor: "white",
                      color: "#0F1B2D",
                    }}
                  />
                </div>
              )}
              <div className="flex gap-3">
                <button
                  onClick={goBack}
                  className="flex-1 rounded-xl py-3.5 text-sm font-semibold border-2 transition-all duration-150"
                  style={{ borderColor: "#0F1B2D15", color: "#0F1B2D60" }}
                >
                  Back
                </button>
                <button
                  onClick={goNext}
                  disabled={!interviewRole || (interviewRole === "Other" && !interviewRoleCustom.trim())}
                  className="flex-[2] rounded-xl py-3.5 text-sm font-semibold text-white transition-all duration-150 disabled:opacity-40"
                  style={{ backgroundColor: "#F0953E" }}
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* ── STEP: interview_confirmed ──────────────────────────────────── */}
          {currentStep === "interview_confirmed" && (
            <div className="space-y-6">
              <div>
                <h1
                  className="text-3xl font-semibold leading-tight"
                  style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: "#0F1B2D" }}
                >
                  Do you have a confirmed interview date?
                </h1>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => { setHasConfirmedInterview(true); goNext(); }}
                  className={`rounded-2xl border-2 py-6 text-sm font-semibold transition-all duration-150 ${
                    hasConfirmedInterview === true
                      ? "border-[#F0953E] bg-[#F0953E]/8 text-[#0F1B2D]"
                      : "border-[#0F1B2D]/12 bg-white text-[#0F1B2D]/70 hover:border-[#F0953E]/50"
                  }`}
                >
                  Yes
                </button>
                <button
                  onClick={() => { setHasConfirmedInterview(false); goNext(); }}
                  className={`rounded-2xl border-2 py-6 text-sm font-semibold transition-all duration-150 ${
                    hasConfirmedInterview === false
                      ? "border-[#F0953E] bg-[#F0953E]/8 text-[#0F1B2D]"
                      : "border-[#0F1B2D]/12 bg-white text-[#0F1B2D]/70 hover:border-[#F0953E]/50"
                  }`}
                >
                  Not yet
                </button>
              </div>
              <button
                onClick={goBack}
                className="w-full rounded-xl py-3 text-sm font-medium border-2 transition-all duration-150"
                style={{ borderColor: "#0F1B2D15", color: "#0F1B2D60" }}
              >
                Back
              </button>
            </div>
          )}

          {/* ── STEP: interview_detail ─────────────────────────────────────── */}
          {currentStep === "interview_detail" && hasConfirmedInterview && (
            <div className="space-y-6">
              <div>
                <h1
                  className="text-3xl font-semibold leading-tight"
                  style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: "#0F1B2D" }}
                >
                  When is your interview?
                </h1>
              </div>
              <div>
                <p className="text-xs font-medium mb-2" style={{ color: "#0F1B2D50" }}>Interview date</p>
                <input
                  type="date"
                  value={interviewDate}
                  onChange={(e) => setInterviewDate(e.target.value)}
                  className="w-full rounded-xl border-2 px-4 py-3 text-sm focus:outline-none transition-colors"
                  style={{
                    borderColor: interviewDate ? "#F0953E" : "#0F1B2D15",
                    backgroundColor: "white",
                    color: "#0F1B2D",
                  }}
                />
              </div>
              <div>
                <p className="text-xs font-medium mb-2" style={{ color: "#0F1B2D50" }}>What stage are you currently at?</p>
                <div className="space-y-2">
                  {INTERVIEW_STAGES.map(s => (
                    <OptionCard
                      key={s}
                      label={s}
                      selected={interviewStage === s}
                      onClick={() => setInterviewStage(s)}
                    />
                  ))}
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={goBack}
                  className="flex-1 rounded-xl py-3.5 text-sm font-semibold border-2 transition-all duration-150"
                  style={{ borderColor: "#0F1B2D15", color: "#0F1B2D60" }}
                >
                  Back
                </button>
                <button
                  onClick={goNext}
                  disabled={!interviewDate && !interviewStage}
                  className="flex-[2] rounded-xl py-3.5 text-sm font-semibold text-white transition-all duration-150 disabled:opacity-40"
                  style={{ backgroundColor: "#F0953E" }}
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {currentStep === "interview_detail" && hasConfirmedInterview === false && (
            <div className="space-y-6">
              <div>
                <h1
                  className="text-3xl font-semibold leading-tight"
                  style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: "#0F1B2D" }}
                >
                  What best describes your timeline?
                </h1>
              </div>
              <div className="space-y-2">
                {INTERVIEW_TIMELINES.map(t => (
                  <OptionCard
                    key={t}
                    label={t}
                    selected={interviewTimeline === t}
                    onClick={() => setInterviewTimeline(t)}
                  />
                ))}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={goBack}
                  className="flex-1 rounded-xl py-3.5 text-sm font-semibold border-2 transition-all duration-150"
                  style={{ borderColor: "#0F1B2D15", color: "#0F1B2D60" }}
                >
                  Back
                </button>
                <button
                  onClick={goNext}
                  disabled={!interviewTimeline}
                  className="flex-[2] rounded-xl py-3.5 text-sm font-semibold text-white transition-all duration-150 disabled:opacity-40"
                  style={{ backgroundColor: "#F0953E" }}
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* ── STEP: environment (Workplace) ──────────────────────────────── */}
          {currentStep === "environment" && (
            <div className="space-y-6">
              <div>
                <h1
                  className="text-3xl font-semibold leading-tight"
                  style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: "#0F1B2D" }}
                >
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
                      setWorkEnvironment(env.id);
                      if (env.id !== "other") setWorkEnvironmentCustom("");
                    }}
                  />
                ))}
              </div>
              {workEnvironment === "other" && (
                <input
                  type="text"
                  value={workEnvironmentCustom}
                  onChange={(e) => setWorkEnvironmentCustom(e.target.value)}
                  placeholder="Describe your work environment"
                  autoFocus
                  className="w-full rounded-xl border-2 px-4 py-3 text-sm focus:outline-none transition-colors"
                  style={{
                    borderColor: workEnvironmentCustom ? "#F0953E" : "#0F1B2D15",
                    backgroundColor: "white",
                    color: "#0F1B2D",
                  }}
                />
              )}
              <div className="flex gap-3">
                <button
                  onClick={goBack}
                  className="flex-1 rounded-xl py-3.5 text-sm font-semibold border-2 transition-all duration-150"
                  style={{ borderColor: "#0F1B2D15", color: "#0F1B2D60" }}
                >
                  Back
                </button>
                <button
                  onClick={goNext}
                  disabled={!workEnvironment || (workEnvironment === "other" && !workEnvironmentCustom.trim())}
                  className="flex-[2] rounded-xl py-3.5 text-sm font-semibold text-white transition-all duration-150 disabled:opacity-40"
                  style={{ backgroundColor: "#F0953E" }}
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* ── STEP: current_role (Workplace) ─────────────────────────────── */}
          {currentStep === "current_role" && (
            <div className="space-y-6">
              <div>
                <h1
                  className="text-3xl font-semibold leading-tight"
                  style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: "#0F1B2D" }}
                >
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
                      setWorkCurrentRole(role);
                      if (role !== "Other") setWorkCurrentRoleCustom("");
                    }}
                  />
                ))}
              </div>
              {workCurrentRole === "Other" && (
                <input
                  type="text"
                  value={workCurrentRoleCustom}
                  onChange={(e) => setWorkCurrentRoleCustom(e.target.value)}
                  placeholder="Describe your role"
                  autoFocus
                  className="w-full rounded-xl border-2 px-4 py-3 text-sm focus:outline-none transition-colors"
                  style={{
                    borderColor: workCurrentRoleCustom ? "#F0953E" : "#0F1B2D15",
                    backgroundColor: "white",
                    color: "#0F1B2D",
                  }}
                />
              )}
              <div className="flex gap-3">
                <button
                  onClick={goBack}
                  className="flex-1 rounded-xl py-3.5 text-sm font-semibold border-2 transition-all duration-150"
                  style={{ borderColor: "#0F1B2D15", color: "#0F1B2D60" }}
                >
                  Back
                </button>
                <button
                  onClick={goNext}
                  disabled={!workCurrentRole || (workCurrentRole === "Other" && !workCurrentRoleCustom.trim())}
                  className="flex-[2] rounded-xl py-3.5 text-sm font-semibold text-white transition-all duration-150 disabled:opacity-40"
                  style={{ backgroundColor: "#F0953E" }}
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* ── STEP: high_stakes (Workplace) ──────────────────────────────── */}
          {currentStep === "high_stakes" && (
            <div className="space-y-6">
              <div>
                <h1
                  className="text-3xl font-semibold leading-tight"
                  style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: "#0F1B2D" }}
                >
                  Where does executive presence matter most for you?
                </h1>
                <p className="mt-2 text-sm" style={{ color: "#0F1B2D60" }}>
                  Select all that apply.
                </p>
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
              <div className="flex gap-3">
                <button
                  onClick={goBack}
                  className="flex-1 rounded-xl py-3.5 text-sm font-semibold border-2 transition-all duration-150"
                  style={{ borderColor: "#0F1B2D15", color: "#0F1B2D60" }}
                >
                  Back
                </button>
                <button
                  onClick={goNext}
                  disabled={highStakesContexts.length === 0}
                  className="flex-[2] rounded-xl py-3.5 text-sm font-semibold text-white transition-all duration-150 disabled:opacity-40"
                  style={{ backgroundColor: "#F0953E" }}
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* ── STEP: self_assessment ──────────────────────────────────────── */}
          {currentStep === "self_assessment" && (
            <div className="space-y-6">
              <div>
                <h1
                  className="text-3xl font-semibold leading-tight"
                  style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: "#0F1B2D" }}
                >
                  How would you rate your executive presence today?
                </h1>
                <p className="mt-2 text-sm" style={{ color: "#0F1B2D60" }}>
                  There are no right or wrong answers — this helps personalise your experience and gives you a baseline to track growth over time.
                </p>
              </div>
              <div
                className="rounded-2xl p-5 space-y-6"
                style={{ backgroundColor: "white", border: "2px solid #0F1B2D08" }}
              >
                {SELF_ASSESSMENT_DIMS.map(dim => (
                  <SliderRow
                    key={dim.key}
                    label={dim.label}
                    description={dim.description}
                    value={selfAssessment[dim.key]}
                    onChange={(v) => setSelfAssessment(prev => ({ ...prev, [dim.key]: v }))}
                  />
                ))}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={goBack}
                  className="flex-1 rounded-xl py-3.5 text-sm font-semibold border-2 transition-all duration-150"
                  style={{ borderColor: "#0F1B2D15", color: "#0F1B2D60" }}
                >
                  Back
                </button>
                <button
                  onClick={goNext}
                  className="flex-[2] rounded-xl py-3.5 text-sm font-semibold text-white transition-all duration-150"
                  style={{ backgroundColor: "#F0953E" }}
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* ── STEP: baseline ─────────────────────────────────────────────── */}
          {currentStep === "baseline" && (
            <div className="space-y-6">
              <div>
                <p
                  className="text-xs tracking-widest uppercase mb-3"
                  style={{ fontFamily: "'DM Mono', monospace", color: "#F0953E" }}
                >
                  Final step
                </p>
                <h1
                  className="text-4xl font-semibold leading-tight"
                  style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: "#0F1B2D" }}
                >
                  Your baseline recording.
                </h1>
                <p className="mt-3 text-sm leading-relaxed" style={{ color: "#0F1B2D65" }}>
                  Before your first coached session, we capture a short baseline — a snapshot of where you are today. It takes 1–2 minutes and gives us everything we need to personalise your coaching from day one.
                </p>
              </div>

              {/* Prompt card */}
              <div
                className="rounded-2xl overflow-hidden"
                style={{ backgroundColor: "#0F1B2D" }}
              >
                <div className="h-0.5 w-full" style={{ background: "linear-gradient(to right, #F0953E, #C84A18)" }} />
                <div className="px-6 py-6">
                  <p
                    className="text-xs uppercase tracking-widest mb-3"
                    style={{ fontFamily: "'DM Mono', monospace", color: "rgba(255,255,255,0.35)" }}
                  >
                    Your baseline prompt
                  </p>
                  <p
                    className="text-[1.35rem] font-semibold leading-snug"
                    style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: "white" }}
                  >
                    {BASELINE_PROMPT}
                  </p>
                  <p className="mt-4 text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
                    1–2 minutes recommended
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <button
                  onClick={save}
                  disabled={loading}
                  className="w-full rounded-xl py-4 text-sm font-semibold text-white transition-all duration-150 disabled:opacity-60"
                  style={{ backgroundColor: "#F0953E" }}
                >
                  {loading ? "Saving your profile…" : "Begin Baseline Recording"}
                </button>
                <button
                  onClick={goBack}
                  className="w-full rounded-xl py-3 text-sm font-medium border-2 transition-all duration-150"
                  style={{ borderColor: "#0F1B2D15", color: "#0F1B2D60" }}
                >
                  Back
                </button>
              </div>

              <p className="text-xs text-center" style={{ color: "#0F1B2D35" }}>
                You can always record more sessions after completing your baseline.
              </p>
            </div>
          )}

        </div>
      </div>

      {/* Bottom padding for scroll */}
      <div className="h-8" />
    </div>
  );
}
