import { useQuery } from "@tanstack/react-query";
import { getStats } from "@/lib/api";
import Layout from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Video, Mic, TrendingUp, Clock, CheckCircle } from "lucide-react";

function fmt(n: number | null | undefined, suffix = "") {
  if (n == null) return "—";
  return `${n.toLocaleString()}${suffix}`;
}

function fmtDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function StatCard({ title, value, sub, icon: Icon, color = "text-primary" }: {
  title: string; value: string; sub?: string; icon: React.ElementType; color?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className={`w-4 h-4 ${color}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-foreground">{value}</div>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { data, isLoading, error } = useQuery({ queryKey: ["admin-stats"], queryFn: getStats });

  return (
    <Layout title="Dashboard">
      {isLoading && (
        <div className="text-muted-foreground text-sm">Loading stats…</div>
      )}
      {error && (
        <div className="text-destructive text-sm">Failed to load stats: {(error as Error).message}</div>
      )}
      {data && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <StatCard
              title="Total Users"
              value={fmt(data.totalUsers)}
              sub="all registered accounts"
              icon={Users}
            />
            <StatCard
              title="Total Sessions"
              value={fmt(data.totalSessions)}
              sub={`${fmt(data.completedSessions)} completed`}
              icon={CheckCircle}
              color="text-green-600"
            />
            <StatCard
              title="Avg Score"
              value={data.avgCompositeScore != null ? `${data.avgCompositeScore}` : "—"}
              sub="composite across all completed"
              icon={TrendingUp}
              color="text-amber-500"
            />
            <StatCard
              title="Total Recording Time"
              value={fmtDuration(data.totalRecordingSeconds)}
              sub={`${fmt(data.totalRecordingSeconds)} seconds total`}
              icon={Clock}
            />
            <StatCard
              title="Audio Sessions"
              value={fmt(data.audioSessions)}
              sub="completed audio recordings"
              icon={Mic}
              color="text-blue-500"
            />
            <StatCard
              title="Video Sessions"
              value={fmt(data.videoSessions)}
              sub="completed video recordings"
              icon={Video}
              color="text-purple-500"
            />
          </div>
        </div>
      )}
    </Layout>
  );
}
