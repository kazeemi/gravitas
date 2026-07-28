import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { getUserDetail, patchUser, deleteUser, type SessionRow } from "@/lib/api";
import Layout from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Shield, ShieldOff, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

// Presets cover the common cases: standard signup, a serious evaluation, and a
// full pilot cohort programme.
const ALLOWANCE_PRESETS = [
  { label: "30m", minutes: 30 },
  { label: "2h", minutes: 120 },
  { label: "5h", minutes: 300 },
];

function tierLabel(score: number | null) {
  if (score == null) return null;
  if (score >= 80) return { label: "Distinguished", cls: "bg-[#EDF4EF] text-[#6B9B7A] border-[#6B9B7A]" };
  if (score >= 65) return { label: "Strong", cls: "bg-[#F5F0E3] text-[#A08838] border-[#A08838]" };
  if (score >= 50) return { label: "Developing", cls: "bg-[#FAF5E4] text-[#C9A020] border-[#C9A020]" };
  return { label: "Needs Focus", cls: "bg-[#FAF0E8] text-[#C05A1E] border-[#C05A1E]" };
}

function statusBadge(status: string) {
  if (status === "complete") return <Badge className="bg-green-100 text-green-800 border-green-200">Complete</Badge>;
  if (status === "processing") return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Processing</Badge>;
  if (status === "failed") return <Badge className="bg-red-100 text-red-800 border-red-200">Failed</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}

export default function UserDetailPage() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-user", params.id],
    queryFn: () => getUserDetail(params.id),
  });

  const toggleAdmin = useMutation({
    mutationFn: (isAdmin: boolean) => patchUser(params.id, { isAdmin }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-user", params.id] });
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      toast({ description: "User updated." });
    },
    onError: (e: Error) => toast({ variant: "destructive", description: e.message }),
  });

  const [allowanceMins, setAllowanceMins] = useState("");

  const setAllowance = useMutation({
    mutationFn: (minutes: number) =>
      patchUser(params.id, { recordingSecondsAllowance: minutes * 60 }),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["admin-user", params.id] });
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      toast({ description: `Recording allowance set to ${Math.round(result.recordingSecondsAllowance / 60)} minutes.` });
    },
    onError: (e: Error) => toast({ variant: "destructive", description: e.message }),
  });

  // Seed the input from the saved allowance once the user loads.
  useEffect(() => {
    if (data?.user.recordingSecondsAllowance != null) {
      setAllowanceMins(String(Math.round(data.user.recordingSecondsAllowance / 60)));
    }
  }, [data?.user.recordingSecondsAllowance]);

  const deleteUserMutation = useMutation({
    mutationFn: () => deleteUser(params.id),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      toast({ description: `Deleted ${result.email} and all their data.` });
      navigate("/users");
    },
    onError: (e: Error) => toast({ variant: "destructive", description: e.message }),
  });

  if (isLoading) return <Layout title="User Detail" backHref="/users" backLabel="Users"><p className="text-muted-foreground text-sm">Loading…</p></Layout>;
  if (error || !data) return <Layout title="User Detail" backHref="/users" backLabel="Users"><p className="text-destructive text-sm">Error: {(error as Error | null)?.message ?? "Not found"}</p></Layout>;

  const { user, sessions } = data;
  const tier = tierLabel(user.avgScore ?? null);

  const currentAllowanceMins = Math.round(user.recordingSecondsAllowance / 60);
  const parsedAllowance = Number(allowanceMins);
  // Mirrors the server ceiling of 24h so the button disables before a rejected request.
  const allowanceValid =
    allowanceMins.trim() !== "" &&
    Number.isInteger(parsedAllowance) &&
    parsedAllowance >= 0 &&
    parsedAllowance <= 1440;
  const allowanceChanged = allowanceValid && parsedAllowance !== currentAllowanceMins;

  return (
    <Layout title={user.name ?? user.email} backHref="/users" backLabel="Users">
      <div className="space-y-6 max-w-4xl">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="md:col-span-2">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-base">{user.name ?? <span className="italic text-muted-foreground">No name</span>}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-0.5">{user.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  {user.isAdmin && <Badge variant="secondary">Admin</Badge>}
                  {!user.onboardingCompleted && <Badge variant="outline" className="text-muted-foreground">Onboarding</Badge>}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-y-2 gap-x-4">
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wider mb-0.5">Role</p>
                  <p>{user.roleTitle ?? "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wider mb-0.5">Context</p>
                  <p>{user.communicationContext ?? "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wider mb-0.5">Goal</p>
                  <p className="line-clamp-2">{user.goal ?? "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wider mb-0.5">Default Recording</p>
                  <p className="capitalize">{user.defaultRecordingContext ?? "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wider mb-0.5">Email Summaries</p>
                  <p>{user.emailSummaries ? "On" : "Off"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wider mb-0.5">Joined</p>
                  <p>{format(new Date(user.createdAt), "MMM d, yyyy")}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardContent className="pt-5 space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Completed sessions</span>
                  <span className="font-medium">{user.completedSessions}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Avg score</span>
                  <div className="flex items-center gap-2">
                    {user.avgScore != null && <span className="font-medium">{user.avgScore}</span>}
                    {tier && <Badge className={tier.cls}>{tier.label}</Badge>}
                    {user.avgScore == null && <span className="text-muted-foreground">—</span>}
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Recording time</span>
                  <span className="font-medium tabular-nums">
                    {Math.floor(user.totalRecordingSeconds / 60)}m
                    <span className="text-muted-foreground font-normal">
                      {" / "}{currentAllowanceMins}m
                    </span>
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-5">
                <p className="text-xs text-muted-foreground mb-3">Recording allowance</p>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min={0}
                    value={allowanceMins}
                    onChange={(e) => setAllowanceMins(e.target.value)}
                    className="h-9"
                    aria-label="Recording allowance in minutes"
                  />
                  <Button
                    size="sm"
                    className="h-9 shrink-0"
                    disabled={setAllowance.isPending || !allowanceChanged}
                    onClick={() => setAllowance.mutate(parsedAllowance)}
                  >
                    {setAllowance.isPending ? "Saving…" : "Save"}
                  </Button>
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {allowanceMins.trim() !== "" && !allowanceValid
                    ? "Enter a whole number of minutes, up to 1440."
                    : "Minutes of total recording time."}
                </p>
                <div className="mt-3 flex gap-1.5">
                  {ALLOWANCE_PRESETS.map((p) => (
                    <Button
                      key={p.minutes}
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      disabled={setAllowance.isPending}
                      onClick={() => {
                        setAllowanceMins(String(p.minutes));
                        setAllowance.mutate(p.minutes);
                      }}
                    >
                      {p.label}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-5 space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-3">Admin access</p>
                  {user.isAdmin ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full gap-2 text-destructive hover:text-destructive"
                      onClick={() => toggleAdmin.mutate(false)}
                      disabled={toggleAdmin.isPending}
                    >
                      <ShieldOff className="w-4 h-4" />
                      Revoke admin
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full gap-2"
                      onClick={() => toggleAdmin.mutate(true)}
                      disabled={toggleAdmin.isPending}
                    >
                      <Shield className="w-4 h-4" />
                      Grant admin
                    </Button>
                  )}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-3">Danger zone</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-2 text-destructive hover:text-destructive border-destructive/30 hover:border-destructive"
                    onClick={() => {
                      if (confirm(`Permanently delete ${user.email} and all their sessions? This cannot be undone.`)) {
                        deleteUserMutation.mutate();
                      }
                    }}
                    disabled={deleteUserMutation.isPending}
                  >
                    <Trash2 className="w-4 h-4" />
                    {deleteUserMutation.isPending ? "Deleting…" : "Delete user"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-foreground mb-3">Sessions ({sessions.length})</h2>
          {sessions.length === 0 && <p className="text-muted-foreground text-sm">No sessions yet.</p>}
          {sessions.length > 0 && (
            <div className="border rounded-lg overflow-hidden bg-card">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Date</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Mode</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Prompt</th>
                    <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Score</th>
                    <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Duration</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s: SessionRow) => {
                    const t = tierLabel(s.compositeScore);
                    return (
                      <tr
                        key={s.id}
                        className="border-b last:border-0 hover:bg-muted/30 cursor-pointer transition-colors"
                        onClick={() => navigate(`/sessions/${s.id}`)}
                      >
                        <td className="px-4 py-2.5 text-muted-foreground text-xs">
                          {format(new Date(s.createdAt), "MMM d, yyyy")}
                        </td>
                        <td className="px-4 py-2.5 capitalize">{s.mode}</td>
                        <td className="px-4 py-2.5 max-w-xs">
                          <span className="line-clamp-1 text-muted-foreground">
                            {s.promptText ?? <span className="italic">No prompt</span>}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {s.compositeScore != null && <span className="tabular-nums">{s.compositeScore}</span>}
                            {t && <Badge className={t.cls}>{t.label}</Badge>}
                            {s.compositeScore == null && <span className="text-muted-foreground">—</span>}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                          {s.durationSeconds != null ? `${Math.round(s.durationSeconds)}s` : "—"}
                        </td>
                        <td className="px-4 py-2.5">{statusBadge(s.processingStatus)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
