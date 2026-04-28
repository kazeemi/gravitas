import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { getSessionDetail, type DimensionScore } from "@/lib/api";
import Layout from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

const DIMENSION_LABELS: Record<string, string> = {
  command_presence: "Command Presence",
  vocal_delivery: "Vocal Delivery",
  language_impact: "Language Impact",
  authenticity: "Authenticity",
  visual_engagement: "Visual Engagement",
  eye_contact: "Eye Contact",
  posture_gesture: "Posture & Gesture",
  nonverbal_energy: "Nonverbal Energy",
};

function tierColor(tier: string) {
  if (tier === "distinguished") return "text-green-700";
  if (tier === "strong") return "text-blue-700";
  if (tier === "developing") return "text-amber-700";
  return "text-red-700";
}

function ScoreBar({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${Math.min(100, score)}%` }}
        />
      </div>
      <span className="text-sm font-medium tabular-nums w-8 text-right">{score}</span>
    </div>
  );
}

export default function SessionDetailPage() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-session", params.id],
    queryFn: () => getSessionDetail(params.id),
  });

  if (isLoading) return <Layout title="Session" backHref="/" backLabel="Back"><p className="text-muted-foreground text-sm">Loading…</p></Layout>;
  if (error || !data) return <Layout title="Session" backHref="/" backLabel="Back"><p className="text-destructive text-sm">Error loading session</p></Layout>;

  const { session, user, dimensionScores } = data;

  const backHref = `/users/${session.userId}`;

  return (
    <Layout title="Session Detail" backHref={backHref} backLabel={user.name ?? user.email}>
      <div className="space-y-6 max-w-4xl">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="md:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Session Info</CardTitle>
            </CardHeader>
            <CardContent className="text-sm grid grid-cols-2 gap-y-2 gap-x-4">
              <div>
                <p className="text-muted-foreground text-xs uppercase tracking-wider mb-0.5">User</p>
                <button className="text-primary hover:underline" onClick={() => navigate(backHref)}>
                  {user.name ?? user.email}
                </button>
              </div>
              <div>
                <p className="text-muted-foreground text-xs uppercase tracking-wider mb-0.5">Mode</p>
                <p className="capitalize">{session.mode}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs uppercase tracking-wider mb-0.5">Date</p>
                <p>{format(new Date(session.createdAt), "MMM d, yyyy 'at' h:mm a")}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs uppercase tracking-wider mb-0.5">Duration</p>
                <p className="tabular-nums">{session.durationSeconds != null ? `${Math.round(session.durationSeconds)}s` : "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs uppercase tracking-wider mb-0.5">Recording Context</p>
                <p className="capitalize">{session.recordingContext ?? "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs uppercase tracking-wider mb-0.5">Status</p>
                <p className="capitalize">{session.processingStatus}</p>
              </div>
              {session.promptText && (
                <div className="col-span-2">
                  <p className="text-muted-foreground text-xs uppercase tracking-wider mb-0.5">Prompt</p>
                  <p className="text-foreground">{session.promptText}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Score</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-3">
              {session.compositeScore != null ? (
                <>
                  <div className="text-4xl font-bold text-foreground tabular-nums">{session.compositeScore}</div>
                  {session.compositeTier && (
                    <Badge className="capitalize">{session.compositeTier}</Badge>
                  )}
                </>
              ) : (
                <p className="text-muted-foreground">No score yet</p>
              )}
            </CardContent>
          </Card>
        </div>

        {dimensionScores.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Dimension Scores</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
                {dimensionScores.map((d: DimensionScore) => (
                  <div key={d.id} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">
                        {DIMENSION_LABELS[d.dimensionKey] ?? d.dimensionKey}
                      </span>
                      <span className={`text-xs font-medium capitalize ${tierColor(d.tier)}`}>{d.tier}</span>
                    </div>
                    <ScoreBar score={d.score} />
                    {(d.strengthText || d.gapText || d.nextStepText) && (
                      <div className="text-xs text-muted-foreground space-y-0.5 mt-1">
                        {d.strengthText && <p><span className="font-medium text-green-700">+</span> {d.strengthText}</p>}
                        {d.gapText && <p><span className="font-medium text-amber-700">△</span> {d.gapText}</p>}
                        {d.nextStepText && <p><span className="font-medium text-primary">→</span> {d.nextStepText}</p>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {session.overallFeedback && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Overall Feedback</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{session.overallFeedback}</p>
            </CardContent>
          </Card>
        )}

        {session.transcript && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Transcript</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-96 overflow-y-auto">
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap font-mono">{session.transcript}</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
