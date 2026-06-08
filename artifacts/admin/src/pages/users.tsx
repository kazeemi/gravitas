import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { getUsers, type UserRow } from "@/lib/api";
import Layout from "@/components/layout";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, RefreshCw } from "lucide-react";
import { format } from "date-fns";

function tierBadge(score: number | null) {
  if (score == null) return null;
  if (score >= 80) return <Badge className="bg-[#EDF4EF] text-[#6B9B7A] border-[#6B9B7A]">Distinguished</Badge>;
  if (score >= 65) return <Badge className="bg-[#F5F0E3] text-[#A08838] border-[#A08838]">Strong</Badge>;
  if (score >= 50) return <Badge className="bg-[#FAF5E4] text-[#C9A020] border-[#C9A020]">Developing</Badge>;
  return <Badge className="bg-[#FAF0E8] text-[#C05A1E] border-[#C05A1E]">Needs Focus</Badge>;
}

function fmtDuration(s: number) {
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

export default function UsersPage() {
  const [search, setSearch] = useState("");
  const [, navigate] = useLocation();

  const { data, isLoading, isFetching, error, refetch } = useQuery({ queryKey: ["admin-users"], queryFn: getUsers });

  const filtered = (data?.users ?? []).filter(u => {
    const q = search.toLowerCase();
    return (
      u.email.toLowerCase().includes(q) ||
      (u.name ?? "").toLowerCase().includes(q) ||
      (u.roleTitle ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <Layout title="Users">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search by email, name, role…"
              className="pl-9"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`w-4 h-4 mr-1.5 ${isFetching ? "animate-spin" : ""}`} />
            {isFetching ? "Refreshing…" : "Refresh"}
          </Button>
        </div>

        {isLoading && <p className="text-muted-foreground text-sm">Loading users…</p>}
        {error && <p className="text-destructive text-sm">Error: {(error as Error).message}</p>}

        {!isLoading && !error && (
          <div className="border rounded-lg overflow-hidden bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">User</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Role / Context</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Sessions</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Avg Score</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Recording Time</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Joined</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No users found</td>
                  </tr>
                )}
                {filtered.map((u: UserRow) => (
                  <tr
                    key={u.id}
                    className="border-b last:border-0 hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={() => navigate(`/users/${u.id}`)}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{u.name ?? <span className="text-muted-foreground italic">No name</span>}</div>
                      <div className="text-muted-foreground text-xs">{u.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-foreground">{u.roleTitle ?? <span className="text-muted-foreground italic">—</span>}</div>
                      <div className="text-muted-foreground text-xs">{u.communicationContext ?? "—"}</div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{u.completedSessions}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {u.avgScore != null && <span className="tabular-nums">{u.avgScore}</span>}
                        {tierBadge(u.avgScore)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                      {u.totalRecordingSeconds > 0 ? fmtDuration(u.totalRecordingSeconds) : "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {format(new Date(u.createdAt), "MMM d, yyyy")}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {u.isAdmin && <Badge variant="secondary">Admin</Badge>}
                        {!u.onboardingCompleted && <Badge variant="outline" className="text-muted-foreground">Onboarding</Badge>}
                        {u.onboardingCompleted && u.completedSessions === 0 && <Badge variant="outline" className="text-amber-600 border-amber-200">No sessions</Badge>}
                        {u.onboardingCompleted && u.completedSessions > 0 && <Badge variant="outline" className="text-green-700 border-green-200">Active</Badge>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {filtered.length > 0 && (
          <p className="text-xs text-muted-foreground">{filtered.length} user{filtered.length !== 1 ? "s" : ""}</p>
        )}
      </div>
    </Layout>
  );
}
