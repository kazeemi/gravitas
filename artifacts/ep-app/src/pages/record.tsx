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
  AlertTriangleIcon,
} from "lucide-react";

const SILENCE_THRESHOLD = 8;      // avg amplitude (0–255) below which = silence
const SILENCE_WARN_SECS = 10;     // seconds of continuous silence before warning
const LEVEL_CHECK_MS = 150;       // how often to sample audio level (ms)
const EARLY_NO_AUDIO_SECS = 5;    // seconds before showing "mic not working" alert

// ── WAV encoder (for converting iOS mp4 recordings to a format OpenAI accepts) ──

function _wavWriteString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
}

function _encodeWav(audioBuffer: AudioBuffer): ArrayBuffer {
  const sampleRate = audioBuffer.sampleRate;
  const samples = audioBuffer.getChannelData(0);
  const dataSize = samples.length * 2;
  const buf = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buf);
  _wavWriteString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  _wavWriteString(view, 8, "WAVE");
  _wavWriteString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  _wavWriteString(view, 36, "data");
  view.setUint32(40, dataSize, true);
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }
  return buf;
}

async function convertToWavBlob(blob: Blob): Promise<Blob> {
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const tempCtx = new AudioContext();
    const audioBuffer = await tempCtx.decodeAudioData(arrayBuffer);
    await tempCtx.close();
    const targetSampleRate = 16000;
    const offlineCtx = new OfflineAudioContext(
      1,
      Math.ceil(audioBuffer.duration * targetSampleRate),
      targetSampleRate
    );
    const source = offlineCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(offlineCtx.destination);
    source.start(0);
    const resampled = await offlineCtx.startRendering();
    return new Blob([_encodeWav(resampled)], { type: "audio/wav" });
  } catch {
    return blob;
  }
}

type Step = "setup" | "recording" | "review" | "processing" | "done";
type RecordingState = "idle" | "recording" | "paused";

const MIN_DURATION = 60;
const MAX_DURATION = 600; // 10 minutes

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

  const [audioLevel, setAudioLevel] = useState(0);       // 0–100 live mic level
  const [silenceWarning, setSilenceWarning] = useState(false);
  const [silenceSecs, setSilenceSecs] = useState(0);      // current silence streak in seconds
  const [earlyNoAudioWarning, setEarlyNoAudioWarning] = useState(false); // mic never picked up audio in first 5s
  const [processingStep, setProcessingStep] = useState(0); // 0–3 for animated steps
  const processingStepRef = useRef<number | null>(null);

  // Holds the raw recording blob + metadata between "recording" and "processing"
  // so the user can optionally download before analysis begins
  const [pendingBlob, setPendingBlob] = useState<Blob | null>(null);
  const [pendingDuration, setPendingDuration] = useState(0);
  const [pendingFrames, setPendingFrames] = useState<string[]>([]);
  const [pendingSilenceEvents, setPendingSilenceEvents] = useState(0);

  const timerRef = useRef<number | null>(null);
  const pollRef = useRef<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const elapsedRef = useRef(0);
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const levelCheckRef = useRef<number | null>(null);
  const silenceMsRef = useRef(0);
  const silenceEventsRef = useRef(0);       // count of distinct 4s+ pause events
  const silenceEventCountedRef = useRef(false); // prevent double-counting within same streak
  const everHadAudioRef = useRef(false);    // true once any real audio signal is detected
  const earlyCheckTimeoutRef = useRef<number | null>(null); // 5s timeout for early no-audio check
  const recordingStateRef = useRef<RecordingState>("idle");
  const framesRef = useRef<string[]>([]);
  const frameIntervalRef = useRef<number | null>(null);
  const firstFrameTimeoutRef = useRef<number | null>(null);
  const videoChunksRef = useRef<Blob[]>([]);
  const videoRecorderRef = useRef<MediaRecorder | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const [pendingVideoBlob, setPendingVideoBlob] = useState<Blob | null>(null);
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

  useEffect(() => {
    recordingStateRef.current = recordingState;
  }, [recordingState]);

  // Auto-stop when max duration reached
  useEffect(() => {
    if (recordingState === "recording" && elapsed >= MAX_DURATION) {
      stopRecording();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsed, recordingState]);

  // Attach camera stream to video element once it mounts (step changes to "recording")
  useEffect(() => {
    if (step === "recording" && mode === "video" && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [step, mode]);

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
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const stopLevelMonitor = useCallback(() => {
    if (levelCheckRef.current) {
      clearInterval(levelCheckRef.current);
      levelCheckRef.current = null;
    }
    if (earlyCheckTimeoutRef.current) {
      clearTimeout(earlyCheckTimeoutRef.current);
      earlyCheckTimeoutRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    silenceMsRef.current = 0;
    everHadAudioRef.current = false;
    setAudioLevel(0);
    setSilenceWarning(false);
    setSilenceSecs(0);
    setEarlyNoAudioWarning(false);
  }, []);

  const captureFrame = useCallback((): string | null => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) return null;
    try {
      const canvas = document.createElement("canvas");
      const scale = Math.min(320 / video.videoWidth, 320 / video.videoHeight);
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
      return dataUrl.split(",")[1] ?? null;
    } catch {
      return null;
    }
  }, []);

  const stopFrameCapture = useCallback(() => {
    if (firstFrameTimeoutRef.current) {
      clearTimeout(firstFrameTimeoutRef.current);
      firstFrameTimeoutRef.current = null;
    }
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
  }, []);

  const startFrameCapture = useCallback(() => {
    framesRef.current = [];
    firstFrameTimeoutRef.current = window.setTimeout(() => {
      const frame = captureFrame();
      if (frame) framesRef.current.push(frame);
      frameIntervalRef.current = window.setInterval(() => {
        if (recordingStateRef.current !== "recording") return;
        if (framesRef.current.length >= 10) return;
        const f = captureFrame();
        if (f) framesRef.current.push(f);
      }, 8000);
    }, 2500);
  }, [captureFrame]);

  const startLevelMonitor = useCallback((stream: MediaStream) => {
    try {
      everHadAudioRef.current = false;
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.6;
      source.connect(analyser);
      audioContextRef.current = ctx;
      analyserRef.current = analyser;

      const data = new Uint8Array(analyser.frequencyBinCount);

      // After EARLY_NO_AUDIO_SECS, if we've never detected real audio, show blocking alert
      earlyCheckTimeoutRef.current = window.setTimeout(() => {
        if (!everHadAudioRef.current && recordingStateRef.current === "recording") {
          setEarlyNoAudioWarning(true);
        }
      }, EARLY_NO_AUDIO_SECS * 1000);

      levelCheckRef.current = window.setInterval(() => {
        if (recordingStateRef.current !== "recording") return;

        analyser.getByteFrequencyData(data);
        const avg = data.reduce((s, v) => s + v, 0) / data.length;
        const level = Math.min(100, Math.round((avg / 80) * 100));
        setAudioLevel(level);

        if (avg < SILENCE_THRESHOLD) {
          silenceMsRef.current += LEVEL_CHECK_MS;
          const secs = Math.floor(silenceMsRef.current / 1000);
          setSilenceSecs(secs);
          if (silenceMsRef.current >= SILENCE_WARN_SECS * 1000) {
            setSilenceWarning(true);
          }
          // Count each distinct 4s+ pause as one silence event
          if (silenceMsRef.current >= 4000 && !silenceEventCountedRef.current) {
            silenceEventsRef.current += 1;
            silenceEventCountedRef.current = true;
          }
        } else {
          // Real audio detected
          if (!everHadAudioRef.current) {
            everHadAudioRef.current = true;
            setEarlyNoAudioWarning(false); // clear early warning if audio detected
          }
          silenceMsRef.current = 0;
          setSilenceSecs(0);
          setSilenceWarning(false);
          silenceEventCountedRef.current = false; // ready to count next distinct pause
        }
      }, LEVEL_CHECK_MS);
    } catch {
      // AudioContext not available — degrade gracefully, no monitor
    }
  }, []);

  const startRecording = async () => {
    setError("");
    try {
      const constraints = mode === "video"
        ? { audio: true, video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } } }
        : { audio: true };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      const session = await api.sessions.create({
        mode,
        promptText: customPrompt.trim() || prompt?.text || undefined,
        promptType: prompt?.type,
        recordingContext: mode === "video" ? recordingContext : "seated",
      });
      setSessionId(session.id);

      audioChunksRef.current = [];
      videoChunksRef.current = [];
      silenceEventsRef.current = 0;
      silenceEventCountedRef.current = false;

      // For analysis: always record audio-only — keeps upload size small.
      // For video mode: also run a second recorder on the full AV stream so the
      // user can optionally download the video with audio from the review screen.
      const audioOnlyStream = mode === "video"
        ? new MediaStream(stream.getAudioTracks())
        : stream;

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "";

      const recorder = new MediaRecorder(audioOnlyStream, mimeType ? { mimeType } : {});
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.start(1000);

      // Second recorder for video download (only in video mode)
      if (mode === "video") {
        const videoMime = MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")
          ? "video/webm;codecs=vp8,opus"
          : MediaRecorder.isTypeSupported("video/webm")
          ? "video/webm"
          : "";
        try {
          const vRecorder = new MediaRecorder(stream, videoMime ? { mimeType: videoMime } : {});
          videoRecorderRef.current = vRecorder;
          vRecorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) videoChunksRef.current.push(e.data);
          };
          vRecorder.start(1000);
        } catch {
          videoRecorderRef.current = null;
        }
      }

      startLevelMonitor(stream);
      if (mode === "video") startFrameCapture();

      // Keep screen awake during recording (no-op if API unavailable)
      if ("wakeLock" in navigator) {
        try {
          wakeLockRef.current = await navigator.wakeLock.request("screen");
        } catch {
          // Wake lock not granted — continue without it
        }
      }

      setStep("recording");
      setRecordingState("recording");
      setElapsed(0);
      elapsedRef.current = 0;
      timerRef.current = window.setInterval(() => setElapsed(e => e + 1), 1000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to start recording";
      setError(
        msg.includes("Permission") || msg.includes("NotAllowed")
          ? `${mode === "video" ? "Camera and microphone" : "Microphone"} permission denied — please allow access and try again.`
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
    // Reset silence counter on pause — don't penalise deliberate pauses
    silenceMsRef.current = 0;
    setSilenceSecs(0);
    setSilenceWarning(false);
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
    stopLevelMonitor();
    stopFrameCapture();
    releaseWakeLock();
    framesRef.current = [];
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
    if (videoRecorderRef.current && videoRecorderRef.current.state !== "inactive") {
      videoRecorderRef.current.stop();
    }
    videoRecorderRef.current = null;
    videoChunksRef.current = [];
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

  const releaseWakeLock = () => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release().catch(() => {});
      wakeLockRef.current = null;
    }
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
    stopLevelMonitor();
    stopFrameCapture();
    releaseWakeLock();
    const capturedFrames = mode === "video" ? [...framesRef.current] : [];

    const capturedSilenceEvents = silenceEventsRef.current;
    const recorder = mediaRecorderRef.current;
    const vRecorder = videoRecorderRef.current;

    if (!recorder || recorder.state === "inactive") {
      submitAudio(finalDuration, new Blob([]), capturedFrames, capturedSilenceEvents);
      return;
    }

    // Stop both recorders; use a counter to wait for both onstop callbacks
    let doneCount = 0;
    const totalRecorders = vRecorder && vRecorder.state !== "inactive" ? 2 : 1;

    const onBothDone = async () => {
      doneCount += 1;
      if (doneCount < totalRecorders) return;

      const audioMime = recorder.mimeType || "audio/webm";
      let blob = new Blob(audioChunksRef.current, { type: audioMime });

      // gpt-audio only accepts WAV and MP3. Always convert to 16kHz mono WAV
      // regardless of what format the browser recorded in (webm, mp4, etc.).
      blob = await convertToWavBlob(blob);

      let videoBlob: Blob | null = null;
      if (videoChunksRef.current.length > 0) {
        const videoMime = vRecorder?.mimeType || "video/webm";
        videoBlob = new Blob(videoChunksRef.current, { type: videoMime });
      }

      releaseStream();
      setPendingBlob(blob);
      setPendingVideoBlob(videoBlob);
      setPendingDuration(finalDuration);
      setPendingFrames(capturedFrames);
      setPendingSilenceEvents(capturedSilenceEvents);
      setStep("review");
    };

    recorder.onstop = onBothDone;
    if (vRecorder && vRecorder.state !== "inactive") {
      vRecorder.onstop = onBothDone;
      vRecorder.stop();
    }
    recorder.stop();
  };

  const downloadBlob = (blob: Blob, label: string) => {
    const ext = blob.type.includes("wav") ? "wav"
      : blob.type.includes("mp4") ? "mp4"
      : blob.type.includes("webm") ? "webm"
      : blob.type.includes("ogg") ? "ogg"
      : blob.type.includes("mp3") ? "mp3"
      : "webm";
    const date = new Date().toISOString().slice(0, 10);
    const filename = `executive-presence-${label}-${date}.${ext}`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadRecording = () => {
    if (pendingBlob) downloadBlob(pendingBlob, "audio");
  };

  const downloadVideoRecording = () => {
    if (pendingVideoBlob) downloadBlob(pendingVideoBlob, "video");
  };

  const proceedToAnalysis = () => {
    if (!pendingBlob) return;
    submitAudio(pendingDuration, pendingBlob, pendingFrames, pendingSilenceEvents);
    setPendingBlob(null);
    setPendingVideoBlob(null);
  };

  const submitAudio = async (durationSeconds: number, audioBlob: Blob, videoFrames: string[] = [], silenceEvents = 0) => {
    if (!sessionId) return;
    setStep("processing");
    setProcessingStep(0);

    // Advance through processing steps on a timer so the user sees progress
    let step = 0;
    processingStepRef.current = window.setInterval(() => {
      step = Math.min(step + 1, 3);
      setProcessingStep(step);
    }, 12000);

    try {
      await api.sessions.upload(sessionId, {
        durationSeconds,
        audioGapEvents: 0,
        faceLostEvents: 0,
        silenceEvents,
        audioBlob: audioBlob.size > 0 ? audioBlob : undefined,
        videoFrames: videoFrames.length > 0 ? videoFrames : undefined,
      });

      setProcessingStep(s => Math.max(s, 1));

      pollRef.current = window.setInterval(async () => {
        try {
          const status = await api.sessions.status(sessionId);
          if (status.processingStatus === "complete") {
            clearInterval(pollRef.current!);
            if (processingStepRef.current) clearInterval(processingStepRef.current);
            setProcessingStep(4);
            setStep("done");
          } else if (status.processingStatus === "error") {
            clearInterval(pollRef.current!);
            if (processingStepRef.current) clearInterval(processingStepRef.current);
            setError(status.processingError || "Processing failed");
            setStep("recording");
            setRecordingState("paused");
          }
        } catch {}
      }, 2000);
    } catch (err) {
      if (processingStepRef.current) clearInterval(processingStepRef.current);
      const msg = err instanceof Error ? err.message : "Failed to upload";
      setError(msg);
      setStep("recording");
      setRecordingState("paused");
    }
  };

  useEffect(() => {
    return () => {
      stopTimer();
      stopLevelMonitor();
      stopFrameCapture();
      if (mediaRecorderRef.current?.state !== "inactive") {
        mediaRecorderRef.current?.stop();
      }
      releaseStream();
      if (pollRef.current) clearInterval(pollRef.current);
      if (processingStepRef.current) clearInterval(processingStepRef.current);
    };
  }, [stopTimer, releaseStream, stopLevelMonitor, stopFrameCapture]);

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
        <h1 className="text-2xl font-bold text-gray-900">Let's record a new session</h1>
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
                      {m === "audio" ? "Voice & delivery" : "Voice & visual presence"}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>


          <div>
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">Practice prompt</label>
              {!customPrompt.trim() && (
                <button
                  onClick={getNewPrompt}
                  className="text-xs font-medium text-gray-600 hover:text-gray-900 underline underline-offset-2"
                >
                  Get a new prompt
                </button>
              )}
            </div>
            {!customPrompt.trim() && prompt && (
              <div className="mt-2 rounded border border-gray-200 bg-gray-50 p-4">
                <p className="text-sm text-gray-700">{prompt.text}</p>
                <p className="mt-2 text-xs text-gray-400">
                  Recommended: {Math.floor(prompt.recommendedDurationSeconds / 60)}:
                  {String(prompt.recommendedDurationSeconds % 60).padStart(2, "0")} min
                </p>
              </div>
            )}
            <div className="mt-3">
              <p className="text-xs font-medium text-gray-500 mb-1">
                {customPrompt.trim() ? "Your topic (practice prompt hidden)" : "Or write your own:"}
              </p>
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="Describe what you'll be speaking about…"
                rows={2}
                className="w-full rounded border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-900"
              />
              {customPrompt.trim() && (
                <button
                  onClick={() => setCustomPrompt("")}
                  className="mt-1 text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2"
                >
                  Clear and use practice prompt instead
                </button>
              )}
            </div>
          </div>

          <Button className="w-full gap-2" onClick={startRecording}>
            <PlayCircleIcon className="h-4 w-4" />
            Start recording
          </Button>

          <p className="text-center text-xs text-gray-400">Minimum 1 minute · maximum 10 minutes.</p>

          <p className="text-center text-xs text-gray-400">
            Your recording is deleted immediately after scoring. No one at Gravitas or your organization has access to your audio or video.
            <br />
            During beta only, Gravitas may review session transcripts to validate scoring accuracy.
          </p>
        </div>
      )}
      {step === "recording" && (
        <div className="space-y-6">

          {earlyNoAudioWarning && (
            <div className="rounded-lg border-2 border-red-400 bg-red-50 px-4 py-4 text-sm">
              <div className="flex items-start gap-3">
                <AlertTriangleIcon className="h-5 w-5 flex-shrink-0 text-red-500 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold text-red-800 text-base">Microphone not picking up audio</p>
                  <p className="mt-1 text-red-700">
                    Your mic is on but no sound is reaching the app. If you continue, the recording won't produce results.
                  </p>
                  <ul className="mt-2 text-xs text-red-600 space-y-0.5 list-disc list-inside">
                    <li>Check your browser has microphone permission</li>
                    <li>Make sure the correct mic is selected in your OS settings</li>
                    <li>Try unplugging and replugging headphones</li>
                  </ul>
                  <div className="mt-3 flex items-center gap-3">
                    <Button
                      size="sm"
                      className="bg-red-600 hover:bg-red-700 text-white gap-1.5"
                      onClick={restartRecording}
                    >
                      <RotateCcwIcon className="h-3.5 w-3.5" />
                      Stop & fix microphone
                    </Button>
                    <button
                      className="text-xs text-red-500 underline underline-offset-2 hover:text-red-700"
                      onClick={() => setEarlyNoAudioWarning(false)}
                    >
                      Continue anyway
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {!earlyNoAudioWarning && silenceWarning && (
            <div className="rounded border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-700 flex items-start gap-2">
              <AlertTriangleIcon className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">No audio detected for {silenceSecs}s</p>
                <p className="mt-0.5 text-xs text-red-600">
                  Your microphone isn't picking up any sound. Check that the correct microphone is selected and that it's not muted.
                </p>
              </div>
            </div>
          )}

          <div className="text-center space-y-4">
            {mode === "video" ? (
              <div className="relative aspect-video w-full rounded-lg overflow-hidden bg-gray-900">
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="h-full w-full object-cover scale-x-[-1]"
                />
                {recordingState === "recording" && (
                  <div className="absolute top-2 right-2 flex items-center gap-1.5 rounded-full bg-red-600 px-2.5 py-1">
                    <div className="h-2 w-2 rounded-full bg-white animate-pulse" />
                    <span className="text-xs font-semibold text-white">REC</span>
                  </div>
                )}
                {recordingState === "paused" && (
                  <div className="absolute top-2 right-2 flex items-center gap-1.5 rounded-full bg-amber-500 px-2.5 py-1">
                    <span className="text-xs font-semibold text-white">PAUSED</span>
                  </div>
                )}
              </div>
            ) : (
              <div
                className={`mx-auto flex h-24 w-24 items-center justify-center rounded-full ${
                  recordingState === "recording"
                    ? silenceWarning ? "bg-red-100" : "bg-red-50 animate-pulse"
                    : "bg-gray-100"
                }`}
              >
                <MicIcon
                  className={`h-10 w-10 ${
                    recordingState === "recording"
                      ? silenceWarning ? "text-[#C84A18]" : "text-[#F0953E]"
                      : "text-gray-400"
                  }`}
                />
              </div>
            )}

            {recordingState === "recording" && (
              <div className="mx-auto w-48 space-y-1">
                <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-150 ${
                      audioLevel === 0
                        ? "bg-gray-300 w-0"
                        : audioLevel < 15
                        ? "bg-red-400"
                        : audioLevel < 40
                        ? "bg-amber-400"
                        : "bg-[#C84A18]"
                    }`}
                    style={{ width: `${Math.max(2, audioLevel)}%` }}
                  />
                </div>
                <p className="text-xs text-gray-400">
                  {audioLevel === 0 ? "No audio signal" : audioLevel < 15 ? "Very low — speak louder" : audioLevel < 40 ? "Low level" : "Good level"}
                </p>
              </div>
            )}

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                {recordingState === "paused" ? "Paused" : "Recording"}
              </p>
              <p className="mt-1 text-3xl font-bold font-mono text-gray-900">
                {formatTime(elapsed)}
              </p>
              {elapsed < MIN_DURATION ? (
                <p className="mt-1 text-xs text-amber-600">
                  {MIN_DURATION - elapsed}s remaining to reach minimum
                </p>
              ) : elapsed >= MAX_DURATION - 60 ? (
                <p className="mt-1 text-xs text-red-500">
                  {MAX_DURATION - elapsed}s until maximum — recording will stop automatically
                </p>
              ) : (
                <p className="mt-1 text-xs text-gray-400">
                  Max {formatTime(MAX_DURATION)} · {formatTime(MAX_DURATION - elapsed)} remaining
                </p>
              )}
            </div>
          </div>

          {(customPrompt.trim() || prompt?.text) && (
            <div className="rounded border border-gray-100 bg-gray-50 p-4">
              <p className="text-xs font-medium text-gray-400 mb-1">Your prompt</p>
              <p className="text-sm text-gray-700">{customPrompt.trim() || prompt?.text}</p>
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
              disabled={elapsed < MIN_DURATION}
              variant="outline"
              className={`gap-1.5 ${
                elapsed < MIN_DURATION
                  ? "border-gray-100 text-gray-300 cursor-not-allowed"
                  : "border-red-200 text-red-600 hover:bg-red-50"
              }`}
            >
              <StopCircleIcon className="h-4 w-4" />
              Stop & analyze
            </Button>
          </div>
        </div>
      )}
      {step === "review" && (
        <div className="space-y-6 py-4">
          <div className="text-center space-y-2">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
              <CheckCircleIcon className="h-7 w-7 text-gray-700" />
            </div>
            <p className="text-lg font-semibold text-gray-900">Recording complete</p>
            <p className="text-sm text-gray-500">{Math.floor(pendingDuration / 60)}:{String(pendingDuration % 60).padStart(2, "0")} recorded</p>
          </div>

          <div className="rounded border border-gray-100 bg-gray-50 p-4 space-y-3">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Keep a local copy</p>
            <p className="text-sm text-gray-600">
              {mode === "video"
                ? "Download your audio or video recording before analysis. These recordings are not stored on our servers."
                : "Download your audio recording before analysis. This recording is not stored on our servers."}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={downloadRecording}
                className="flex items-center gap-2 rounded border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download audio
              </button>
              {mode === "video" && pendingVideoBlob && (
                <button
                  onClick={downloadVideoRecording}
                  className="flex items-center gap-2 rounded border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download video
                </button>
              )}
            </div>
          </div>

          <Button className="w-full gap-2" onClick={proceedToAnalysis}>
            <PlayCircleIcon className="h-4 w-4" />
            Analyze my recording
          </Button>
        </div>
      )}
      {step === "processing" && (() => {
        const steps = mode === "video"
          ? ["Uploading recording", "Transcribing speech", "Analyzing delivery & visual presence", "Generating coaching feedback"]
          : ["Uploading recording", "Transcribing speech", "Analyzing delivery", "Generating coaching feedback"];
        const progress = Math.min(100, Math.round((processingStep / (steps.length - 1)) * 100));
        return (
          <div className="py-10 space-y-8">
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>Analyzing…</span>
                <span>{progress}%</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gray-900 transition-all duration-700 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
            <div className="space-y-3">
              {steps.map((label, i) => {
                const done = processingStep > i;
                const active = processingStep === i;
                return (
                  <div key={label} className="flex items-center gap-3">
                    <div className={`flex-shrink-0 h-6 w-6 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                      done ? "bg-[#C84A18] text-white" : active ? "bg-[#0F1B2D] text-white" : "bg-gray-100 text-gray-400"
                    }`}>
                      {done ? (
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <span>{i + 1}</span>
                      )}
                    </div>
                    <span className={`text-sm ${done ? "text-gray-400 line-through" : active ? "text-gray-900 font-medium" : "text-gray-400"}`}>
                      {label}
                      {active && <span className="ml-1 inline-block animate-pulse">…</span>}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-center text-gray-400">This typically takes 30–60 seconds</p>
          </div>
        );
      })()}
      {step === "done" && sessionId && (
        <div className="space-y-4 text-center py-12">
          <CheckCircleIcon className="mx-auto h-12 w-12 text-[#C84A18]" />
          <p className="text-lg font-semibold text-gray-900">Analysis complete!</p>
          <p className="text-sm text-gray-500">Your personalized coaching feedback is ready.</p>
          <Button onClick={() => setLocation(`/sessions/${sessionId}`)}>View results</Button>
        </div>
      )}
    </div>
  );
}
