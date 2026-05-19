import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CheckIcon } from "lucide-react";

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

export default function SettingsPage() {
  const { user, logout, refreshUser } = useAuth();

  // ── Profile ──
  const [name, setName] = useState(user?.name || "");
  const [roleTitle, setRoleTitle] = useState(user?.roleTitle || "");
  const [goal, setGoal] = useState(user?.goal || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // ── Password ──
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);

  // ── Coaching profile ──
  const [coachingGoal, setCoachingGoal] = useState<"interview" | "workplace" | "">(
    user?.primaryGoal === "interview_prep" ? "interview"
    : user?.primaryGoal === "workplace_presence" ? "workplace"
    : (user?.interviewMode ? "interview" : "")
  );
  const [educationLevel, setEducationLevel] = useState(user?.educationLevel ?? "");
  const [workExperienceYears, setWorkExperienceYears] = useState(user?.workExperienceYears ?? "");

  // Interview fields
  const [interviewSector, setInterviewSector] = useState(user?.interviewSector ?? "");
  const [interviewSectorCustom, setInterviewSectorCustom] = useState(user?.interviewSectorCustom ?? "");
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>(
    user?.interviewCompanies ? user.interviewCompanies.split("; ").filter(Boolean) : []
  );
  const [companyCustom, setCompanyCustom] = useState("");
  const [interviewRole, setInterviewRole] = useState(user?.interviewRole ?? "");
  const [hasConfirmedInterview, setHasConfirmedInterview] = useState<boolean | null>(
    user?.hasConfirmedInterview ?? null
  );
  const [interviewDate, setInterviewDate] = useState(user?.interviewDate ?? "");
  const [interviewTimeline, setInterviewTimeline] = useState(user?.interviewTimeline ?? "");

  // Workplace fields
  const [workEnvironment, setWorkEnvironment] = useState(user?.workEnvironment ?? "");
  const [workCurrentRole, setWorkCurrentRole] = useState(user?.workCurrentRole ?? "");
  const [workCurrentRoleCustom, setWorkCurrentRoleCustom] = useState(user?.workCurrentRoleCustom ?? "");
  const [highStakesContexts, setHighStakesContexts] = useState<string[]>(
    user?.highStakesContexts ? user.highStakesContexts.split("; ").filter(Boolean) : []
  );

  const [coachingSaving, setCoachingSaving] = useState(false);
  const [coachingSaved, setCoachingSaved] = useState(false);

  // ── Helpers ──
  const toggleCompany = (company: string) =>
    setSelectedCompanies(prev =>
      prev.includes(company) ? prev.filter(c => c !== company) : [...prev, company]
    );

  const toggleHighStakes = (ctx: string) =>
    setHighStakesContexts(prev =>
      prev.includes(ctx) ? prev.filter(c => c !== ctx) : [...prev, ctx]
    );

  const knownCompanies = Object.values(COMPANIES_BY_INDUSTRY).flat();
  const companiesList = COMPANIES_BY_INDUSTRY[interviewSector] ?? [];
  const customCompaniesInList = selectedCompanies.filter(c => !knownCompanies.includes(c));

  // ── Handlers ──
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      await api.users.update({ name, roleTitle, goal });
      await refreshUser();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {}
    setSaving(false);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError("");
    setPwSuccess(false);
    if (newPassword.length < 8) {
      setPwError("New password must be at least 8 characters");
      return;
    }
    setPwLoading(true);
    try {
      await api.auth.changePassword(currentPassword, newPassword);
      setPwSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
    } catch (err) {
      setPwError(err instanceof Error ? err.message : "Failed to change password");
    }
    setPwLoading(false);
  };

  const handleSaveCoachingProfile = async () => {
    setCoachingSaving(true);
    setCoachingSaved(false);
    try {
      const isInterview = coachingGoal === "interview";
      const isWorkplace = coachingGoal === "workplace";
      const companies = [...selectedCompanies];
      if (companyCustom.trim() && !companies.includes(companyCustom.trim())) {
        companies.push(companyCustom.trim());
      }
      await api.users.update({
        educationLevel: educationLevel || null,
        workExperienceYears: workExperienceYears || null,
        primaryGoal: isInterview ? "interview_prep" : isWorkplace ? "workplace_presence" : null,
        interviewMode: isInterview,
        interviewSector: isInterview ? (interviewSector || null) : null,
        interviewSectorCustom: isInterview && interviewSector === "other" ? (interviewSectorCustom.trim() || null) : null,
        interviewCompanies: isInterview && companies.length > 0 ? companies.join("; ") : null,
        interviewRole: isInterview ? (interviewRole.trim() || null) : null,
        hasConfirmedInterview: isInterview ? hasConfirmedInterview : null,
        interviewDate: isInterview && hasConfirmedInterview === true ? (interviewDate || null) : null,
        interviewTimeline: isInterview && hasConfirmedInterview === false ? (interviewTimeline || null) : null,
        workEnvironment: isWorkplace ? (workEnvironment || null) : null,
        workCurrentRole: isWorkplace ? (workCurrentRole || null) : null,
        workCurrentRoleCustom: isWorkplace && workCurrentRole === "Other" ? (workCurrentRoleCustom.trim() || null) : null,
        highStakesContexts: isWorkplace && highStakesContexts.length > 0 ? highStakesContexts.join("; ") : null,
      });
      await refreshUser();
      setCoachingSaved(true);
      setTimeout(() => setCoachingSaved(false), 3000);
    } catch {}
    setCoachingSaving(false);
  };

  return (
    <div className="max-w-lg space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">Manage your account and preferences</p>
      </div>

      {/* ── Profile ── */}
      <section className="rounded-lg border border-gray-200 bg-white p-6 space-y-4">
        <h2 className="font-semibold text-gray-900">Profile</h2>
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div>
            <Label htmlFor="name">Full name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="roleTitle">Role / title</Label>
            <Input id="roleTitle" value={roleTitle} onChange={(e) => setRoleTitle(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="goal">Goal</Label>
            <Textarea id="goal" value={goal} onChange={(e) => setGoal(e.target.value)} rows={2} className="mt-1" />
          </div>
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
            {saved && <span className="text-sm text-[#C84A18]">Saved!</span>}
          </div>
        </form>
      </section>

      {/* ── Coaching profile ── */}
      <section className="rounded-lg border border-gray-200 bg-white p-6 space-y-6">
        <div>
          <h2 className="font-semibold text-gray-900">Coaching profile</h2>
          <p className="text-sm text-gray-500 mt-1">
            Gravitas uses this to tailor your practice prompts and feedback.
          </p>
        </div>

        {/* Education */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">Highest level of education</p>
          <div className="grid grid-cols-2 gap-2">
            {EDUCATION_LEVELS.map(e => (
              <button
                key={e.id}
                type="button"
                onClick={() => setEducationLevel(educationLevel === e.id ? "" : e.id)}
                className={`flex items-center justify-between rounded border px-3 py-2.5 text-sm text-left transition-colors ${
                  educationLevel === e.id
                    ? "border-gray-900 bg-gray-900 text-white"
                    : "border-gray-200 hover:border-gray-400"
                }`}
              >
                <span>{e.label}</span>
                {educationLevel === e.id && <CheckIcon className="h-4 w-4 flex-shrink-0 ml-1" />}
              </button>
            ))}
          </div>
        </div>

        {/* Experience */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">Years of full-time work experience</p>
          <div className="grid grid-cols-3 gap-2">
            {EXPERIENCE_YEARS.map(e => (
              <button
                key={e.id}
                type="button"
                onClick={() => setWorkExperienceYears(workExperienceYears === e.id ? "" : e.id)}
                className={`flex items-center justify-between rounded border px-3 py-2 text-sm text-left transition-colors ${
                  workExperienceYears === e.id
                    ? "border-gray-900 bg-gray-900 text-white"
                    : "border-gray-200 hover:border-gray-400"
                }`}
              >
                <span>{e.label}</span>
                {workExperienceYears === e.id && <CheckIcon className="h-3 w-3 flex-shrink-0 ml-1" />}
              </button>
            ))}
          </div>
        </div>

        {/* Primary goal */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">Primary goal</p>
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setCoachingGoal("interview")}
              className={`flex items-center justify-between w-full rounded border px-4 py-3 text-sm text-left transition-colors ${
                coachingGoal === "interview"
                  ? "border-gray-900 bg-gray-900 text-white"
                  : "border-gray-200 hover:border-gray-400"
              }`}
            >
              <span>I'm preparing for an interview</span>
              {coachingGoal === "interview" && <CheckIcon className="h-4 w-4 flex-shrink-0" />}
            </button>
            <button
              type="button"
              onClick={() => setCoachingGoal("workplace")}
              className={`flex items-center justify-between w-full rounded border px-4 py-3 text-sm text-left transition-colors ${
                coachingGoal === "workplace"
                  ? "border-gray-900 bg-gray-900 text-white"
                  : "border-gray-200 hover:border-gray-400"
              }`}
            >
              <span>I want to improve how I show up at work</span>
              {coachingGoal === "workplace" && <CheckIcon className="h-4 w-4 flex-shrink-0" />}
            </button>
          </div>
        </div>

        {/* ── Interview details ── */}
        {coachingGoal === "interview" && (
          <div className="space-y-5 border-t border-gray-100 pt-5">

            {/* Sector */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">Target sector</p>
              <div className="grid grid-cols-2 gap-2">
                {INDUSTRIES.map(s => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setInterviewSector(s.id);
                      setSelectedCompanies([]);
                      if (s.id !== "other") setInterviewSectorCustom("");
                    }}
                    className={`flex items-center justify-between rounded border px-4 py-2.5 text-sm text-left transition-colors ${
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
                <input
                  type="text"
                  value={interviewSectorCustom}
                  onChange={(e) => setInterviewSectorCustom(e.target.value)}
                  placeholder="e.g. Healthcare, Real Estate"
                  className="w-full rounded border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-900 mt-1"
                />
              )}
            </div>

            {/* Companies */}
            {interviewSector && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">Target companies</p>
                <p className="text-xs text-gray-400">Select all that apply</p>
                {companiesList.length > 0 && (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {companiesList.map(company => {
                      const selected = selectedCompanies.includes(company);
                      return (
                        <button
                          key={company}
                          type="button"
                          onClick={() => toggleCompany(company)}
                          className={`flex items-center gap-3 w-full rounded border px-3 py-2.5 text-sm text-left transition-colors ${
                            selected ? "border-gray-900 bg-gray-50" : "border-gray-200 hover:border-gray-400"
                          }`}
                        >
                          <span
                            className={`h-4 w-4 flex-shrink-0 rounded border-2 flex items-center justify-center ${
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
                {customCompaniesInList.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => toggleCompany(c)}
                    className="flex items-center gap-3 w-full rounded border border-gray-900 bg-gray-50 px-3 py-2.5 text-sm text-left"
                  >
                    <span className="h-4 w-4 flex-shrink-0 rounded border-2 border-gray-900 bg-gray-900 flex items-center justify-center">
                      <CheckIcon className="h-3 w-3 text-white" />
                    </span>
                    <span>{c}</span>
                  </button>
                ))}
                <div className="pt-1">
                  <input
                    type="text"
                    value={companyCustom}
                    onChange={(e) => setCompanyCustom(e.target.value)}
                    placeholder={companiesList.length > 0 ? "Add another company…" : "Company name"}
                    className="w-full rounded border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-900"
                  />
                </div>
              </div>
            )}

            {/* Role */}
            <div>
              <Label htmlFor="interviewRole">Role I'm targeting</Label>
              <Input
                id="interviewRole"
                value={interviewRole}
                onChange={(e) => setInterviewRole(e.target.value)}
                className="mt-1"
                placeholder="e.g. Associate Consultant"
              />
            </div>

            {/* Confirmed? */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">Do you have an interview scheduled?</p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setHasConfirmedInterview(true)}
                  className={`flex-1 rounded border px-4 py-2.5 text-sm transition-colors ${
                    hasConfirmedInterview === true
                      ? "border-gray-900 bg-gray-900 text-white"
                      : "border-gray-200 hover:border-gray-400"
                  }`}
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => setHasConfirmedInterview(false)}
                  className={`flex-1 rounded border px-4 py-2.5 text-sm transition-colors ${
                    hasConfirmedInterview === false
                      ? "border-gray-900 bg-gray-900 text-white"
                      : "border-gray-200 hover:border-gray-400"
                  }`}
                >
                  Not yet
                </button>
              </div>
            </div>

            {hasConfirmedInterview === true && (
              <div>
                <Label htmlFor="interviewDate">Interview date</Label>
                <Input
                  id="interviewDate"
                  type="date"
                  value={interviewDate}
                  onChange={(e) => setInterviewDate(e.target.value)}
                  className="mt-1"
                />
              </div>
            )}

            {hasConfirmedInterview === false && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">Roughly when?</p>
                <div className="space-y-1.5">
                  {INTERVIEW_TIMELINES.map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setInterviewTimeline(t)}
                      className={`flex items-center justify-between w-full rounded border px-4 py-2.5 text-sm text-left transition-colors ${
                        interviewTimeline === t
                          ? "border-gray-900 bg-gray-900 text-white"
                          : "border-gray-200 hover:border-gray-400"
                      }`}
                    >
                      <span>{t}</span>
                      {interviewTimeline === t && <CheckIcon className="h-4 w-4 flex-shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Workplace details ── */}
        {coachingGoal === "workplace" && (
          <div className="space-y-5 border-t border-gray-100 pt-5">

            {/* Environment */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">Work environment</p>
              <div className="grid grid-cols-2 gap-2">
                {WORK_ENVIRONMENTS.map(e => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => setWorkEnvironment(workEnvironment === e.id ? "" : e.id)}
                    className={`flex items-center justify-between rounded border px-3 py-2.5 text-sm text-left transition-colors ${
                      workEnvironment === e.id
                        ? "border-gray-900 bg-gray-900 text-white"
                        : "border-gray-200 hover:border-gray-400"
                    }`}
                  >
                    <span>{e.label}</span>
                    {workEnvironment === e.id && <CheckIcon className="h-4 w-4 flex-shrink-0 ml-1" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Current role */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">Current role level</p>
              <div className="space-y-1.5">
                {WORKPLACE_ROLES.map(role => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => {
                      setWorkCurrentRole(role);
                      if (role !== "Other") setWorkCurrentRoleCustom("");
                    }}
                    className={`flex items-center justify-between w-full rounded border px-4 py-2.5 text-sm text-left transition-colors ${
                      workCurrentRole === role
                        ? "border-gray-900 bg-gray-900 text-white"
                        : "border-gray-200 hover:border-gray-400"
                    }`}
                  >
                    <span>{role}</span>
                    {workCurrentRole === role && <CheckIcon className="h-4 w-4 flex-shrink-0" />}
                  </button>
                ))}
              </div>
              {workCurrentRole === "Other" && (
                <input
                  type="text"
                  value={workCurrentRoleCustom}
                  onChange={(e) => setWorkCurrentRoleCustom(e.target.value)}
                  placeholder="Describe your role"
                  className="w-full rounded border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-900 mt-1"
                />
              )}
            </div>

            {/* High-stakes contexts */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">Where does executive presence matter most for you?</p>
              <p className="text-xs text-gray-400">Select all that apply</p>
              <div className="space-y-1.5">
                {HIGH_STAKES_CONTEXTS.map(ctx => {
                  const selected = highStakesContexts.includes(ctx);
                  return (
                    <button
                      key={ctx}
                      type="button"
                      onClick={() => toggleHighStakes(ctx)}
                      className={`flex items-center gap-3 w-full rounded border px-3 py-2.5 text-sm text-left transition-colors ${
                        selected ? "border-gray-900 bg-gray-50" : "border-gray-200 hover:border-gray-400"
                      }`}
                    >
                      <span
                        className={`h-4 w-4 flex-shrink-0 rounded border-2 flex items-center justify-center ${
                          selected ? "border-gray-900 bg-gray-900" : "border-gray-300"
                        }`}
                      >
                        {selected && <CheckIcon className="h-3 w-3 text-white" />}
                      </span>
                      <span>{ctx}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 pt-1">
          <Button
            type="button"
            onClick={handleSaveCoachingProfile}
            disabled={coachingSaving}
          >
            {coachingSaving ? "Saving…" : "Save coaching profile"}
          </Button>
          {coachingSaved && <span className="text-sm text-[#C84A18]">Saved!</span>}
        </div>
      </section>

      {/* ── Change password ── */}
      <section className="rounded-lg border border-gray-200 bg-white p-6 space-y-4">
        <h2 className="font-semibold text-gray-900">Change password</h2>
        <form onSubmit={handleChangePassword} className="space-y-4">
          {pwError && (
            <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{pwError}</div>
          )}
          {pwSuccess && (
            <div className="rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
              Password changed successfully.
            </div>
          )}
          <div>
            <Label htmlFor="currentPassword">Current password</Label>
            <Input
              id="currentPassword"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="newPassword">New password</Label>
            <Input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="mt-1"
              minLength={8}
            />
          </div>
          <Button type="submit" disabled={pwLoading}>
            {pwLoading ? "Changing…" : "Change password"}
          </Button>
        </form>
      </section>

      {/* ── Account ── */}
      <section className="rounded-lg border border-red-100 bg-white p-6 space-y-4">
        <h2 className="font-semibold text-gray-900">Account</h2>
        <Button
          variant="outline"
          className="border-red-200 text-red-600 hover:bg-red-50"
          onClick={logout}
        >
          Sign out
        </Button>
      </section>
    </div>
  );
}
