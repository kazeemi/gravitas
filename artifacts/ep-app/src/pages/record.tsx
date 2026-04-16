import { useState, useEffect, useRef } from "react";
import { useLocation, useSearch } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { api, type Prompt } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MicIcon, VideoIcon, StopCircleIcon, PlayCircleIcon, CheckCircleIcon } from "lucide-react";

type Step = "setup" | "prompt" | "recording" | "processing" | "done";

export default function RecordPage() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const modeParam = params.get("mode") as "audio" | "video" | null;

  const [mode, setMode] = useState<"audio" | "video">(modeParam || "audio");
  const [step, setStep] = useState<Step>("setup");
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [customPrompt, setCustomPrompt] = useState("");
  const [recordingContext, setRecordingContext] = useState("seated");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState("");
  const [processingStatus, setProcessingStatus] = useState("");
  const timerRef = useRef<number | null>(null);
  const pollRef = useRef<number | null>(null);
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (modeParam) setMode(modeParam);
  }, [modeParam]);

  useEffect(() => {
    api.prompts.random().then(setPrompt).catch(() => {});
  }, []);

  const startRecording = async () => {
    setError("");
    try {
      const session = await api.sessions.create({
        mode,
        promptText: prompt?.text || customPrompt || undefined,
        promptType: prompt?.type,
        recordingContext,
      });
      setSessionId(session.id);
      setStep("recording");
      setElapsed(0);
      timerRef.current = window.setInterval(() => setElapsed(e => e + 1), 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start session");
    }
  };

  const stopRecording = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!sessionId) return;
    setStep("processing");
    setProcessingStatus("Uploading and analyzing…");
    try {
      await api.sessions.upload(sessionId, {
        durationSeconds: elapsed,
        audioGapEvents: 0,
        faceLostEvents: 0,
        transcript: transcript || undefined,
      });
      pollRef.current = window.setInterval(async () => {
        try {
          const status = await api.sessions.status(sessionId);
          if (status.processingStatus === "complete") {
            clearInterval(pollRef.current!);
            setStep("done");
          } else if (status.processingStatus === "error") {
            clearInterval(pollRef.current!);
            setError(status.processingError || "Processing failed");
            setStep("recording");
          }
        } catch {}
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process session");
      setStep("setup");
    }
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const getNewPrompt = () => {
    api.prompts.random().then(setPrompt).catch(() => {});
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">New session</h1>
        <p className="mt-1 text-sm text-gray-500">Record and analyze your executive presence</p>
      </div>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      {step === "setup" && (
        <div className="space-y-6">
          <div>
            <label className="text-sm font-medium text-gray-700">Session type</label>
            <div className="mt-2 grid grid-cols-2 gap-3">
              {(["audio", "video"] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`flex items-center gap-3 rounded border p-4 transition-colors ${
                    mode === m ? "border-gray-900 bg-gray-50" : "border-gray-200"
                  }`}
                >
                  {m === "audio" ? (
                    <MicIcon className="h-5 w-5 text-gray-600" />
                  ) : (
                    <VideoIcon className="h-5 w-5 text-gray-600" />
                  )}
                  <div className="text-left">
                    <p className="text-sm font-medium capitalize">{m}</p>
                    <p className="text-xs text-gray-400">{m === "audio" ? "6 dimensions" : "10 dimensions"}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">Recording context</label>
            <div className="mt-2 grid grid-cols-2 gap-3">
              {(["seated", "standing"] as const).map(ctx => (
                <button
                  key={ctx}
                  onClick={() => setRecordingContext(ctx)}
                  className={`rounded border p-3 text-sm transition-colors ${
                    recordingContext === ctx ? "border-gray-900 bg-gray-50" : "border-gray-200"
                  }`}
                >
                  <span className="capitalize">{ctx}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">Practice prompt</label>
              <button onClick={getNewPrompt} className="text-xs text-gray-400 hover:text-gray-600">
                Get new prompt
              </button>
            </div>
            {prompt && (
              <div className="mt-2 rounded border border-gray-200 bg-gray-50 p-4">
                <p className="text-sm text-gray-700">{prompt.text}</p>
                <p className="mt-2 text-xs text-gray-400">
                  Recommended: {Math.floor(prompt.recommendedDurationSeconds / 60)}:
                  {String(prompt.recommendedDurationSeconds % 60).padStart(2, "0")} min
                </p>
              </div>
            )}
            <p className="mt-2 text-xs text-gray-400">Or write your own:</p>
            <Textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="Describe what you'll be speaking about…"
              rows={2}
              className="mt-1 text-sm"
            />
          </div>

          <Button className="w-full" onClick={() => setStep("prompt")}>
            Continue
          </Button>
        </div>
      )}

      {step === "prompt" && (
        <div className="space-y-6">
          <div className="rounded-lg border border-gray-200 bg-white p-6 text-center">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Your prompt</p>
            <p className="mt-3 text-lg font-medium text-gray-900">
              {prompt?.text || customPrompt || "Speak freely about a topic of your choice."}
            </p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">
              Transcript (optional — paste or type what you said)
            </label>
            <Textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="You can provide a transcript to improve scoring accuracy of content-based dimensions."
              rows={4}
              className="mt-1 text-sm"
            />
            <p className="mt-1 text-xs text-gray-400">Leave empty for non-verbal analysis only.</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setStep("setup")}>Back</Button>
            <Button className="flex-1 gap-2" onClick={startRecording}>
              <PlayCircleIcon className="h-4 w-4" />
              Start session
            </Button>
          </div>
        </div>
      )}

      {step === "recording" && (
        <div className="space-y-6 text-center">
          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-red-50 animate-pulse">
            {mode === "audio" ? (
              <MicIcon className="h-10 w-10 text-[#E24B4A]" />
            ) : (
              <VideoIcon className="h-10 w-10 text-[#E24B4A]" />
            )}
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Recording</p>
            <p className="mt-1 text-3xl font-bold font-mono text-gray-900">{formatTime(elapsed)}</p>
          </div>
          {(prompt?.text || customPrompt) && (
            <div className="rounded border border-gray-100 bg-gray-50 p-4 text-left">
              <p className="text-sm text-gray-600">{prompt?.text || customPrompt}</p>
            </div>
          )}
          <Button
            onClick={stopRecording}
            variant="outline"
            className="gap-2 border-red-200 text-red-600 hover:bg-red-50"
          >
            <StopCircleIcon className="h-4 w-4" />
            Stop and analyze
          </Button>
        </div>
      )}

      {step === "processing" && (
        <div className="space-y-4 text-center py-12">
          <div className="mx-auto h-12 w-12 rounded-full border-4 border-gray-200 border-t-gray-900 animate-spin" />
          <p className="text-sm text-gray-500">{processingStatus}</p>
          <p className="text-xs text-gray-400">
            Coaching feedback is being generated — this may take up to 30 seconds.
          </p>
        </div>
      )}

      {step === "done" && sessionId && (
        <div className="space-y-4 text-center py-12">
          <CheckCircleIcon className="mx-auto h-12 w-12 text-[#0F6E56]" />
          <p className="text-lg font-semibold text-gray-900">Analysis complete!</p>
          <p className="text-sm text-gray-500">Your results are ready to view.</p>
          <Button onClick={() => setLocation(`/sessions/${sessionId}`)}>
            View results
          </Button>
        </div>
      )}
    </div>
  );
}
