import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CheckIcon } from "lucide-react";

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

export default function SettingsPage() {
  const { user, logout, refreshUser } = useAuth();

  // Profile
  const [name, setName] = useState(user?.name || "");
  const [roleTitle, setRoleTitle] = useState(user?.roleTitle || "");
  const [goal, setGoal] = useState(user?.goal || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Password
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);

  // Interview prep
  const [interviewMode, setInterviewMode] = useState<boolean>(user?.interviewMode ?? false);
  const [interviewSector, setInterviewSector] = useState(user?.interviewSector ?? "");
  const [interviewSectorCustom, setInterviewSectorCustom] = useState(user?.interviewSectorCustom ?? "");
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>(
    user?.interviewCompanies ? user.interviewCompanies.split("; ").filter(Boolean) : []
  );
  const [companyCustom, setCompanyCustom] = useState("");
  const [interviewSaving, setInterviewSaving] = useState(false);
  const [interviewSaved, setInterviewSaved] = useState(false);

  const toggleCompany = (company: string) => {
    setSelectedCompanies(prev =>
      prev.includes(company) ? prev.filter(c => c !== company) : [...prev, company]
    );
  };

  const companiesList = COMPANIES_BY_SECTOR[interviewSector] ?? [];
  const knownCompanies = Object.values(COMPANIES_BY_SECTOR).flat();
  const customCompaniesInList = selectedCompanies.filter(c => !knownCompanies.includes(c));

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

  const handleSaveInterview = async () => {
    setInterviewSaving(true);
    setInterviewSaved(false);
    try {
      const companies = [...selectedCompanies.filter(c => knownCompanies.includes(c) || !knownCompanies.includes(c))];
      if (companyCustom.trim() && !companies.includes(companyCustom.trim())) {
        companies.push(companyCustom.trim());
      }
      await api.users.update({
        interviewMode,
        interviewSector: interviewMode ? (interviewSector || null) : null,
        interviewSectorCustom: interviewMode && interviewSector === "other" ? (interviewSectorCustom.trim() || null) : null,
        interviewCompanies: interviewMode && companies.length > 0 ? companies.join("; ") : null,
      });
      await refreshUser();
      setInterviewSaved(true);
      setTimeout(() => setInterviewSaved(false), 3000);
    } catch {}
    setInterviewSaving(false);
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

      {/* ── Interview prep ── */}
      <section className="rounded-lg border border-gray-200 bg-white p-6 space-y-5">
        <div>
          <h2 className="font-semibold text-gray-900">Interview preparation</h2>
          <p className="text-sm text-gray-500 mt-1">
            When enabled, your practice prompts will be tailored to behavioral interview questions from your target sector.
          </p>
        </div>

        {/* Toggle */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              const next = !interviewMode;
              setInterviewMode(next);
              if (!next) {
                setInterviewSector("");
                setInterviewSectorCustom("");
                setSelectedCompanies([]);
              }
            }}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
              interviewMode ? "bg-gray-900" : "bg-gray-200"
            }`}
            role="switch"
            aria-checked={interviewMode}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ${
                interviewMode ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
          <span className="text-sm font-medium text-gray-700">
            {interviewMode ? "Enabled — prompts are tailored to interviews" : "Disabled — using standard prompts"}
          </span>
        </div>

        {interviewMode && (
          <div className="space-y-5 pt-1">
            {/* Sector */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">Target sector</p>
              <div className="grid grid-cols-2 gap-2">
                {SECTORS.map(s => (
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
                  <div className="space-y-1.5 max-h-56 overflow-y-auto">
                    {companiesList.map(company => {
                      const selected = selectedCompanies.includes(company);
                      return (
                        <button
                          key={company}
                          type="button"
                          onClick={() => toggleCompany(company)}
                          className={`flex items-center gap-3 w-full rounded border px-3 py-2.5 text-sm text-left transition-colors ${
                            selected
                              ? "border-gray-900 bg-gray-50"
                              : "border-gray-200 hover:border-gray-400"
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
                {/* Custom companies already saved but not in current list */}
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
          </div>
        )}

        <div className="flex items-center gap-3 pt-1">
          <Button
            type="button"
            onClick={handleSaveInterview}
            disabled={interviewSaving || (interviewMode && !interviewSector)}
          >
            {interviewSaving ? "Saving…" : "Save preferences"}
          </Button>
          {interviewSaved && <span className="text-sm text-[#C84A18]">Saved!</span>}
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
