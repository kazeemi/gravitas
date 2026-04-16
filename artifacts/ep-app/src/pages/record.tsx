import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useSearch } from "wouter";
import { api, type Prompt } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  MicIcon,
  VideoIcon,
  StopCircleIcon,
  PlayCircleIcon,
  PauseCircleIcon,
  RotateCcwIcon,
  CheckCircleIcon,
  AlertCircleIcon,
} from "lucide-react";

type Step = "setup" | "recording" | "processing" | "done";
type RecordingState = "idle" | "recording" | "paused";

const MIN_DURATION = 60;

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
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [error, setError] = useState("");
  const [processingStatus, setProcessingStatus] = useState("");

  const timerRef = useRef<number | null>(null);
  const pollRef = useRef<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const elapsedRef = useRef(0);
  const streamRef = useRef<MediaStream | null>(null);
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (modeParam) setMode(modeParam);
  }, [modeParam]);

  useEffect(() => {
    api.prompts.random().then(setPrompt).catch(() => {});
  }, []);

  useEffect(() => {
    elapsedRef.current = elapsed;
  }, [elapsed]);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const releaseStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, []);

  const startRecording = async () => {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const session = await api.sessions.create({
        mode,
        promptText: prompt?.text || customPrompt || undefined,
        promptType: prompt?.type,
        recordingContext,
      });
      setSessionId(session.id);

      audioChunksRef.current = [];
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "";

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.start(1000);

      setStep("recording");
      setRecordingState("recording");
      setElapsed(0);
      elapsedRef.current = 0;
      timerRef.current = window.setInterval(() => setElapsed(e => e + 1), 1000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to start recording";
      setError(
        msg.includes("Permission") || msg.includes("NotAllowed")
          ? "Microphone permission denied — please allow microphone access and try again."
          : msg
      );
      releaseStream();
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.pause();
    }
    stopTimer();
    setRecordingState("paused");
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current?.state === "paused") {
      mediaRecorderRef.current.resume();
    }
    timerRef.current = window.setInterval(() => setElapsed(e => e + 1), 1000);
    setRecordingState("recording");
  };

  const restartRecording = async () => {
    stopTimer();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
    releaseStream();

    if (sessionId) {
      try { await api.sessions.delete(sessionId); } catch {}
    }
    setSessionId(null);
    setElapsed(0);
    elapsedRef.current = 0;
    setRecordingState("idle");
    setStep("setup");
    setError("");
  };

  const stopRecording = () => {
    const finalDuration = elapsedRef.current;

    if (finalDuration < MIN_DURATION) {
      setError(
        `Recording too short — please record at least 1 minute (current: ${formatTime(finalDuration)}). Keep going!`
      );
      return;
    }

    if (!sessionId) return;

    stopTimer();

    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      submitAudio(finalDuration, new Blob([]));
      return;
    }

    recorder.onstop = () => {
      const mimeType = recorder.mimeType || "audio/webm";
      const blob = new Blob(audioChunksRef.current, { type: mimeType });
      releaseStream();
      submitAudio(finalDuration, blob);
    };

    recorder.stop();
  };

  const submitAudio = async (durationSeconds: number, audioBlob: Blob) => {
    if (!sessionId) return;
    setStep("processing");
    setProcessingStatus("Uploading audio for analysis…");

    try {
      await api.sessions.upload(sessionId, {
        durationSeconds,
        audioGapEvents: 0,
        faceLostEvents: 0,
        silenceEvents: 0,
        audioBlob: audioBlob.size > 0 ? audioBlob : undefined,
      });

      setProcessingStatus("Transcribing and analyzing your delivery…");

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
            setRecordingState("paused");
          }
        } catch {}
      }, 2000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to upload";
      setError(msg);
      setStep("recording");
      setRecordingState("paused");
    }
  };

  useEffect(() => {
    return () => {
      stopTimer();
      if (mediaRecorderRef.current?.state !== "inactive") {
        mediaRecorderRef.current?.stop();
      }
      releaseStream();
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [stopTimer, releaseStream]);

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
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 flex items-start gap-2">
          <AlertCircleIcon className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
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
                    <p className="text-xs text-gray-400">
                      {m === "audio" ? "6 dimensions" : "10 dimensions"}
                    </p>
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
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="Describe what you'll be speaking about…"
              rows={2}
              className="mt-1 w-full rounded border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-900"
            />
          </div>

          <div className="rounded border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            Minimum recording duration: 1 minute. Your audio will be transcribed and analyzed after recording.
          </div>

          <Button className="w-full gap-2" onClick={startRecording}>
            <PlayCircleIcon className="h-4 w-4" />
            Start recording
          </Button>
        </div>
      )}

      {step === "recording" && (
        <div className="space-y-6">
          <div className="text-center space-y-4">
            <div
              className={`mx-auto flex h-24 w-24 items-center justify-center rounded-full ${
                recordingState === "recording"
                  ? "bg-red-50 animate-pulse"
                  : "bg-gray-100"
              }`}
            >
              <MicIcon
                className={`h-10 w-10 ${
                  recordingState === "recording" ? "text-[#E24B4A]" : "text-gray-400"
                }`}
              />
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                {recordingState === "paused" ? "Paused" : "Recording"}
              </p>
              <p className="mt-1 text-3xl font-bold font-mono text-gray-900">
                {formatTime(elapsed)}
              </p>
              {elapsed < MIN_DURATION && (
                <p className="mt-1 text-xs text-amber-600">
                  {MIN_DURATION - elapsed}s remaining to reach minimum
                </p>
              )}
            </div>
          </div>

          {(prompt?.text || customPrompt) && (
            <div className="rounded border border-gray-100 bg-gray-50 p-4">
              <p className="text-xs font-medium text-gray-400 mb-1">Your prompt</p>
              <p className="text-sm text-gray-700">{prompt?.text || customPrompt}</p>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            {recordingState === "recording" ? (
              <Button
                variant="outline"
                className="gap-1.5 border-amber-200 text-amber-700 hover:bg-amber-50"
                onClick={pauseRecording}
              >
                <PauseCircleIcon className="h-4 w-4" />
                Pause
              </Button>
            ) : (
              <Button
                variant="outline"
                className="gap-1.5 border-green-200 text-green-700 hover:bg-green-50"
                onClick={resumeRecording}
              >
                <PlayCircleIcon className="h-4 w-4" />
                Resume
              </Button>
            )}

            <Button
              variant="outline"
              className="gap-1.5 border-gray-200 text-gray-600 hover:bg-gray-50"
              onClick={restartRecording}
            >
              <RotateCcwIcon className="h-4 w-4" />
              Restart
            </Button>

            <Button
              onClick={stopRecording}
              variant="outline"
              className="gap-1.5 border-red-200 text-red-600 hover:bg-red-50"
            >
              <StopCircleIcon className="h-4 w-4" />
              Stop & analyze
            </Button>
          </div>
        </div>
      )}

      {step === "processing" && (
        <div className="space-y-4 text-center py-12">
          <div className="mx-auto h-12 w-12 rounded-full border-4 border-gray-200 border-t-gray-900 animate-spin" />
          <p className="text-sm font-medium text-gray-700">{processingStatus}</p>
          <p className="text-xs text-gray-400">
            Your audio is being transcribed, your vocal delivery analyzed, and coaching feedback generated.
            This may take up to 60 seconds.
          </p>
        </div>
      )}

      {step === "done" && sessionId && (
        <div className="space-y-4 text-center py-12">
          <CheckCircleIcon className="mx-auto h-12 w-12 text-[#0F6E56]" />
          <p className="text-lg font-semibold text-gray-900">Analysis complete!</p>
          <p className="text-sm text-gray-500">Your personalized coaching feedback is ready.</p>
          <Button onClick={() => setLocation(`/sessions/${sessionId}`)}>View results</Button>
        </div>
      )}
    </div>
  );
}
