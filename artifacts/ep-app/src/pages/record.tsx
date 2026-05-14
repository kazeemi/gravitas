import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useSearch } from "wouter";
import { api, type Prompt } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
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
  ChevronDownIcon,
} from "lucide-react";

const BETA_LIMIT_SECONDS = 1200;

function getCategoryLabel(text?: string): string {
  if (!text) return "Practice";
  const t = text.toLowerCase();
  if (t.includes("interview") || t.includes("hire") || t.includes("candidate")) return "Interview";
  if (t.includes("pitch") || t.includes("investor") || t.includes("raise") || t.includes("funding")) return "Pitch";
  if (t.includes("board") || t.includes("stakeholder") || t.includes("executive")) return "Executive";
  if (t.includes("technical") || t.includes("demo") || t.includes("product") || t.includes("engineer")) return "Product";
  if (t.includes("leadership") || t.includes("lead") || t.includes("team") || t.includes("manag") || t.includes("philosophy")) return "Leadership";
  if (t.includes("conflict") || t.includes("feedback") || t.includes("difficult") || t.includes("conversation")) return "Interpersonal";
  if (t.includes("crisis") || t.includes("issue") || t.includes("problem") || t.includes("mistake")) return "Crisis";
  return "Practice";
}

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

const INSIGHTS = [
  "Pace variation — speeding up, then slowing down — is one of the clearest signals of a confident speaker.",
  "Pausing before a key point signals authority. Most speakers rush exactly when they should slow down.",
  "How you open shapes everything that follows. Listeners decide early whether to lean in or tune out.",
  "Filler words are almost always a symptom of pace. Speaking a little slower naturally reduces them.",
  "Vocal tone is doing more work than most speakers realise — it shapes how a message lands before the words register.",
  "Executive presence compounds. Every session builds on the last, even when progress isn't immediately visible.",
  "The clearest speakers aren't always the most knowledgeable — they're the ones who organise before they speak.",
  "Breath control is the foundation of every other vocal quality. It's where steadiness begins.",
  "Listeners trust what sounds deliberate. Deliberateness comes from structure, not volume.",
  "Upward inflection at the end of a statement quietly undermines it. Statements land better as statements.",
  "The most common mistake in high-stakes conversations is trying to cover too much. One clear idea beats three vague ones.",
  "Eye contact in video calls lands differently than in person — looking at the camera reads as direct even when it feels unnatural.",
  "Confidence language is mostly about what you remove: qualifiers, hedges, and apologies before the point.",
  "Presence isn't charisma. It's the quality of attention you give and the clarity you bring — both are trainable.",
  "A well-placed pause does more than filler words ever can. It signals that what comes next matters.",
  "The gap between knowing what to say and actually saying it clearly is what consistent practice closes.",
  "Projection isn't about being loud. It's about speaking as if the back of the room deserves the message too.",
  "Gestures that match your words reinforce them. Gestures that contradict your words cancel them out.",
  "Posture before you speak matters as much as what you say. How you settle into a moment sets the room's expectations.",
  "Most people speak at a comfortable pace for themselves — not for the person listening. Slowing down is an act of consideration.",
  "Credibility is often lost in the hedges: 'I think', 'sort of', 'maybe', 'just'. The idea was strong before those words arrived.",
  "Recording yourself is uncomfortable because you're finally hearing what your listeners hear. That discomfort is the work.",
];

export default function RecordPage() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const modeParam = params.get("mode") as "audio" | "video" | null;
  const { user, refreshUser } = useAuth();

  const [mode, setMode] = useState<"audio" | "video">(modeParam || "audio");
  const [step, setStep] = useState<Step>("setup");
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [promptIndex, setPromptIndex] = useState(0);
  const [customPrompt, setCustomPrompt] = useState("");
  const [recordingContext, setRecordingContext] = useState("seated");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [error, setError] = useState("");
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [processingStatus, setProcessingStatus] = useState("");
  const [totalRecordingSeconds, setTotalRecordingSeconds] = useState<number>(user?.totalRecordingSeconds ?? 0);
  const [notifySet, setNotifySet] = useState(false);

  const [audioLevel, setAudioLevel] = useState(0);       // 0–100 live mic level
  const [silenceWarning, setSilenceWarning] = useState(false);
  const [silenceSecs, setSilenceSecs] = useState(0);      // current silence streak in seconds
  const [earlyNoAudioWarning, setEarlyNoAudioWarning] = useState(false); // mic never picked up audio in first 5s
  const [processingStep, setProcessingStep] = useState(0); // 0–3 for step labels
  const [progressPct, setProgressPct] = useState(0);       // 0–100 smooth progress bar
  const processingStepRef = useRef<number | null>(null);
  const [insightIdx, setInsightIdx] = useState(0);
  const [insightFade, setInsightFade] = useState(true);
  const [tipsOpen, setTipsOpen] = useState(false);

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
  const quotaRemainingAtStartRef = useRef<number>(BETA_LIMIT_SECONDS);
  const quotaAutoStopRef = useRef(false);

  useEffect(() => {
    refreshUser().catch(() => {});
  }, []);

  useEffect(() => {
    if (modeParam) setMode(modeParam);
  }, [modeParam]);

  const promptParam = params.get("prompt");

  useEffect(() => {
    api.prompts.list().then(data => {
      if (data.prompts.length > 0) {
        setPrompts(data.prompts);
        if (promptParam) {
          const matchIdx = data.prompts.findIndex(p => p.text === promptParam);
          if (matchIdx !== -1) {
            setPromptIndex(matchIdx);
          } else {
            // Prompt was a custom one — pre-fill the custom input
            setCustomPrompt(promptParam);
            setPromptIndex(Math.floor(Math.random() * data.prompts.length));
          }
        } else {
          setPromptIndex(Math.floor(Math.random() * data.prompts.length));
        }
      }
    }).catch(() => {});
  }, []);

  const prompt = prompts[promptIndex] ?? null;

  useEffect(() => {
    if (user?.totalRecordingSeconds !== undefined) {
      setTotalRecordingSeconds(user.totalRecordingSeconds);
    }
  }, [user?.totalRecordingSeconds]);

  // Proactively detect blocked permissions on mount so the user sees guidance
  // immediately rather than only after clicking "Start recording".
  useEffect(() => {
    if (!navigator.permissions) return;
    const names: PermissionName[] = ["microphone"];
    if (mode === "video") names.push("camera" as PermissionName);
    Promise.all(names.map(n => navigator.permissions.query({ name: n }))).then(results => {
      if (results.some(r => r.state === "denied")) {
        setPermissionDenied(true);
      }
      results.forEach(r => {
        r.onchange = () => {
          if (results.some(s => s.state === "denied")) {
            setPermissionDenied(true);
          } else {
            setPermissionDenied(false);
          }
        };
      });
    }).catch(() => {});
  }, [mode]);

  useEffect(() => {
    elapsedRef.current = elapsed;
  }, [elapsed]);

  useEffect(() => {
    recordingStateRef.current = recordingState;
  }, [recordingState]);

  // Auto-stop when max duration or beta quota reached
  useEffect(() => {
    if (recordingState === "recording") {
      if (elapsed >= MAX_DURATION) {
        stopRecording();
      } else if (elapsed >= quotaRemainingAtStartRef.current) {
        quotaAutoStopRef.current = true;
        stopRecording();
      }
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
    const quotaRemaining = BETA_LIMIT_SECONDS - totalRecordingSeconds;
    if (quotaRemaining <= 0) {
      setTotalRecordingSeconds(BETA_LIMIT_SECONDS);
      return;
    }
    quotaRemainingAtStartRef.current = quotaRemaining;
    quotaAutoStopRef.current = false;

    try {
      const constraints = mode === "video"
        ? { audio: true, video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } } }
        : { audio: true };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      setPermissionDenied(false);

      let session: { id: string; mode: string; processingStatus: string };
      try {
        session = await api.sessions.create({
          mode,
          promptText: customPrompt.trim() || prompt?.text || undefined,
          promptType: prompt?.category,
          recordingContext: mode === "video" ? recordingContext : "seated",
        });
      } catch (apiErr) {
        const msg = apiErr instanceof Error ? apiErr.message : "";
        if (msg === "beta_limit_reached") {
          releaseStream();
          setTotalRecordingSeconds(BETA_LIMIT_SECONDS);
          return;
        }
        throw apiErr;
      }
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
      const isPermission =
        msg.includes("Permission") ||
        msg.includes("NotAllowed") ||
        msg.toLowerCase().includes("not allowed") ||
        (err instanceof Error && err.name === "NotAllowedError");
      if (isPermission) {
        setPermissionDenied(true);
        setError("");
      } else {
        setPermissionDenied(false);
        setError(msg);
      }
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

    const wasQuotaStop = quotaAutoStopRef.current;

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

      if (wasQuotaStop) {
        // Auto-submit immediately — skip review screen
        submitAudio(finalDuration, blob, capturedFrames, capturedSilenceEvents);
      } else {
        setPendingBlob(blob);
        setPendingVideoBlob(videoBlob);
        setPendingDuration(finalDuration);
        setPendingFrames(capturedFrames);
        setPendingSilenceEvents(capturedSilenceEvents);
        setStep("review");
      }
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
    setProgressPct(0);

    // Smooth time-elapsed progress animation decoupled from step labels.
    // Uses an exponential curve that approaches 90% asymptotically — never
    // reaches it until the poll confirms the session is truly complete.
    const startTime = Date.now();
    let currentStep = 0;
    processingStepRef.current = window.setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000; // seconds elapsed

      // Exponential approach to 90%: p = 90 * (1 - e^(-t/50))
      // At 20s ≈ 33%, at 40s ≈ 55%, at 70s ≈ 75%, asymptotes to 90%
      const raw = 90 * (1 - Math.exp(-elapsed / 50));
      setProgressPct(Math.round(raw));

      // Step labels advance at realistic time milestones (independent of bar)
      const nextStep =
        elapsed > 40 ? 3 :  // Generating coaching feedback
        elapsed > 20 ? 2 :  // Analyzing delivery
        elapsed > 5  ? 1 :  // Transcribing speech
        0;
      if (nextStep > currentStep) {
        currentStep = nextStep;
        setProcessingStep(nextStep);
      }
    }, 250);

    try {
      await api.sessions.upload(sessionId, {
        durationSeconds,
        audioGapEvents: 0,
        faceLostEvents: 0,
        silenceEvents,
        audioBlob: audioBlob.size > 0 ? audioBlob : undefined,
        videoFrames: videoFrames.length > 0 ? videoFrames : undefined,
      });

      // Force step label to at least "Transcribing" once upload is confirmed
      if (currentStep < 1) {
        currentStep = 1;
        setProcessingStep(1);
      }

      const pollStart = Date.now();
      const POLL_TIMEOUT_MS = 8 * 60 * 1000; // 8 minutes
      pollRef.current = window.setInterval(async () => {
        if (Date.now() - pollStart > POLL_TIMEOUT_MS) {
          clearInterval(pollRef.current!);
          if (processingStepRef.current) clearInterval(processingStepRef.current);
          setError("Analysis is taking longer than expected. This may be a temporary issue — please check your history in a few minutes, or try recording again.");
          setStep("recording");
          setRecordingState("paused");
          return;
        }
        try {
          const status = await api.sessions.status(sessionId);
          if (status.processingStatus === "complete") {
            clearInterval(pollRef.current!);
            if (processingStepRef.current) clearInterval(processingStepRef.current);
            setProgressPct(100); // Only hit 100% when truly done
            setProcessingStep(4);
            refreshUser().catch(() => {});
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

  useEffect(() => {
    if (step !== "processing") return;
    const interval = setInterval(() => {
      setInsightFade(false);
      setTimeout(() => {
        setInsightIdx(i => (i + 1) % INSIGHTS.length);
        setInsightFade(true);
      }, 400);
    }, 5500);
    return () => clearInterval(interval);
  }, [step]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const goPrevPrompt = () => {
    if (prompts.length === 0) return;
    setPromptIndex(i => (i - 1 + prompts.length) % prompts.length);
  };

  const goNextPrompt = () => {
    if (prompts.length === 0) return;
    setPromptIndex(i => (i + 1) % prompts.length);
  };

  const quotaRemaining = Math.max(0, BETA_LIMIT_SECONDS - totalRecordingSeconds);
  const quotaUsedMins = Math.floor(totalRecordingSeconds / 60);
  const quotaUsedSecs = totalRecordingSeconds % 60;
  const isAtLimit = totalRecordingSeconds >= BETA_LIMIT_SECONDS;

  const handleNotifyMe = async () => {
    try {
      await api.users.update({ notifyOnUpgrade: true });
      setNotifySet(true);
    } catch {
      setNotifySet(true);
    }
  };

  if (isAtLimit) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="rounded-2xl border border-gray-200 bg-white px-8 py-10 space-y-6">
          <div className="space-y-3">
            <h1 className="text-2xl font-bold text-gray-900">You have used your 20 minutes.</h1>
            <p className="text-sm text-gray-600 leading-relaxed">
              Your beta recording allowance is complete. We hope the sessions so far have given you a clear picture of where you stand and what to work on next. If you have not already done so, please share your feedback with Kanza Azeemi.
            </p>
            <p className="text-sm text-gray-600 leading-relaxed">
              When paid plans launch, you will be the first to know. Upgrading will give you continued access to recording, scoring, and coaching so you can keep tracking your progress.
            </p>
          </div>

          <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
            <p className="text-sm text-gray-500">We will notify you as soon as upgrades are available.</p>
          </div>

          <div className="space-y-3">
            {notifySet ? (
              <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
                <CheckCircleIcon className="h-4 w-4 text-green-600 flex-shrink-0" />
                <p className="text-sm text-green-800 font-medium">You're on the list — we'll notify you when upgrades launch.</p>
              </div>
            ) : (
              <Button className="w-full" onClick={handleNotifyMe}>
                Got it! Notify me when upgrades launch
              </Button>
            )}
            <button
              onClick={() => setLocation("/history")}
              className="w-full text-sm text-gray-500 hover:text-gray-700 underline underline-offset-2"
            >
              View my session history
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {step === "processing" || step === "done" ? "Your results" : "Record a session"}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {step === "processing"
              ? "Your coaching feedback is being prepared"
              : step === "done"
              ? "Your personalized coaching feedback is ready"
              : "Record and analyze your executive presence"}
          </p>
        </div>
        <div className="flex-shrink-0 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-right">
          <p className="text-xs font-medium text-gray-500 whitespace-nowrap">Beta recording</p>
          <p className="text-xs text-gray-700 whitespace-nowrap font-mono">
            {quotaUsedMins}m {quotaUsedSecs.toString().padStart(2, "0")}s
            <span className="text-gray-400"> / 20m used</span>
          </p>
          <div className="mt-1 h-1 w-24 rounded-full bg-gray-200 overflow-hidden">
            <div
              className="h-full rounded-full bg-gray-700 transition-all"
              style={{ width: `${Math.min(100, (totalRecordingSeconds / BETA_LIMIT_SECONDS) * 100)}%` }}
            />
          </div>
        </div>
      </div>
      {permissionDenied && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-4 text-sm">
          <div className="flex items-start gap-3">
            <AlertCircleIcon className="h-5 w-5 flex-shrink-0 text-red-500 mt-0.5" />
            <div className="flex-1 space-y-3">
              <div>
                <p className="font-semibold text-red-800">
                  {mode === "video" ? "Camera and microphone access blocked" : "Microphone access blocked"}
                </p>
                <p className="mt-1 text-red-700">
                  Try tapping the button below — your browser may prompt you directly. If not, re-enable access manually using the steps below, then tap the button again.
                </p>
              </div>
              <div className="space-y-2 text-red-700">
                <p className="font-medium">If the button below doesn't trigger a prompt, re-enable manually:</p>
                <ul className="space-y-1.5 text-xs list-none">
                  <li className="flex items-start gap-1.5">
                    <span className="font-semibold shrink-0">Chrome (desktop):</span>
                    <span>Click the <strong>lock or info icon</strong> in the address bar → Site settings → set {mode === "video" ? "Camera and Microphone" : "Microphone"} to <strong>Allow</strong>, then try again.</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="font-semibold shrink-0">Chrome (mobile):</span>
                    <span>Tap the <strong>three-dot menu → Settings → Site settings → {mode === "video" ? "Camera / Microphone" : "Microphone"}</strong> → find this site and set to Allow.</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="font-semibold shrink-0">Safari (iPhone/iPad):</span>
                    <span>Go to <strong>Settings → Safari → {mode === "video" ? "Camera / Microphone" : "Microphone"}</strong> → set to Allow. Then return here and try again.</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="font-semibold shrink-0">Firefox:</span>
                    <span>Click the <strong>shield or lock icon</strong> in the address bar → remove the blocked permission → reload the page.</span>
                  </li>
                </ul>
              </div>
              <button
                onClick={() => { setPermissionDenied(false); startRecording(); }}
                className="mt-1 rounded bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 transition-colors"
              >
                I've updated my settings — try again
              </button>
            </div>
          </div>
        </div>
      )}
      {error && !permissionDenied && (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 flex items-start gap-2">
          <AlertCircleIcon className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      {step === "setup" && (
        <div className="space-y-4">

          {/* ── Prompt hero card ── */}
          {!customPrompt.trim() && prompt && (
            <div className="relative overflow-hidden rounded-2xl bg-[#0F1B2D]">
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#F0953E] to-[#C84A18]" />
              <div className="px-6 pt-6 pb-5">
                <div className="flex items-center justify-between mb-4">
                  <span className="inline-flex items-center rounded-full border border-[#F0953E]/30 bg-[#F0953E]/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-[#F0953E]">
                    {getCategoryLabel(prompt.text)}
                  </span>
                  {prompts.length > 1 && (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={goPrevPrompt}
                        className="h-7 w-7 rounded-full border border-white/20 flex items-center justify-center text-white/50 hover:border-white/50 hover:text-white transition-all text-base leading-none"
                        aria-label="Previous prompt"
                      >‹</button>
                      <span className="text-[10px] text-white/30 tabular-nums w-10 text-center">
                        {promptIndex + 1} / {prompts.length}
                      </span>
                      <button
                        onClick={goNextPrompt}
                        className="h-7 w-7 rounded-full border border-white/20 flex items-center justify-center text-white/50 hover:border-white/50 hover:text-white transition-all text-base leading-none"
                        aria-label="Next prompt"
                      >›</button>
                    </div>
                  )}
                </div>
                <p
                  className="text-[1.4rem] font-semibold italic leading-snug text-white"
                  style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
                >
                  {prompt.text}
                </p>
                <p className="mt-4 text-[11px] text-white/35 font-medium tracking-wide">
                  {Math.floor(prompt.recommendedDurationSeconds / 60)}:{String(prompt.recommendedDurationSeconds % 60).padStart(2, "0")} min recommended
                </p>
              </div>
            </div>
          )}

          {/* ── Mode picker ── */}
          <div className="grid grid-cols-2 gap-3">
            {(["audio", "video"] as const).map(m => {
              const isSelected = mode === m;
              return (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`relative overflow-hidden rounded-xl p-5 text-left transition-all duration-200 ${
                    isSelected
                      ? "shadow-md"
                      : "border border-gray-200 bg-white hover:border-[#F0953E]/50 hover:bg-[#FBF7F2]"
                  }`}
                  style={isSelected ? { background: "linear-gradient(135deg, #F0953E 0%, #C84A18 100%)" } : {}}
                >
                  <div className="mb-3 flex items-end gap-[3px] h-8">
                    {m === "audio" ? (
                      [0.45, 0.75, 1, 0.6, 0.85, 0.5, 0.7].map((h, i) => (
                        <div
                          key={i}
                          className="w-1 rounded-full transition-colors duration-200 origin-bottom"
                          style={{
                            height: `${h * 100}%`,
                            backgroundColor: isSelected ? "rgba(255,255,255,0.85)" : "#D1D5DB",
                            animation: isSelected ? `waveBar 1.3s ease-in-out infinite` : "none",
                            animationDelay: `${i * 0.12}s`,
                          }}
                        />
                      ))
                    ) : (
                      <div className="relative flex items-center justify-center w-8 h-8">
                        {isSelected && (
                          <div className="absolute inset-0 rounded-full bg-white/25 animate-ping" style={{ animationDuration: "2.2s" }} />
                        )}
                        <VideoIcon className={`h-5 w-5 relative z-10 transition-colors ${isSelected ? "text-white" : "text-gray-400"}`} />
                      </div>
                    )}
                  </div>
                  <p className={`text-sm font-semibold capitalize ${isSelected ? "text-white" : "text-gray-900"}`}>
                    {m}
                  </p>
                  <p className={`text-xs mt-0.5 ${isSelected ? "text-white/75" : "text-gray-400"}`}>
                    {m === "audio" ? "Voice & delivery" : "Voice & visual presence"}
                  </p>
                </button>
              );
            })}
          </div>

          {/* ── Custom prompt ── */}
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1.5">
              {customPrompt.trim() ? "Your topic (practice prompt hidden)" : "Or speak about your own topic:"}
            </p>
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="Describe what you'll be speaking about…"
              rows={2}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#F0953E] bg-white"
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

          {/* ── Collapsible tips ── */}
          <div className="rounded-xl border border-gray-200 overflow-hidden">
            <button
              onClick={() => setTipsOpen(o => !o)}
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
            >
              <span className="text-sm font-medium text-gray-700">Before you start</span>
              <ChevronDownIcon
                className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${tipsOpen ? "rotate-180" : ""}`}
              />
            </button>
            {tipsOpen && (
              <div className="px-4 pb-4 space-y-2 border-t border-gray-100 pt-3">
                <p className="text-sm text-gray-600 leading-relaxed">
                  You don't need a script — in fact, please don't use one. This is your space to communicate as you would in real life: a meeting, a pitch, an interview, a conversation.
                </p>
                <p className="text-sm text-gray-600 leading-relaxed">
                  We'll reflect back how you show up, not judge what you say.
                </p>
                <p className="text-sm text-gray-600 leading-relaxed">
                  We need at least one minute of recording to provide meaningful feedback.
                </p>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Your recording is deleted as soon as your feedback is ready. We never store it.
                </p>
              </div>
            )}
          </div>

          {/* ── Quota warning ── */}
          {quotaRemaining < 60 && quotaRemaining > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-3">
              <AlertTriangleIcon className="h-4 w-4 flex-shrink-0 text-amber-600 mt-0.5" />
              <p className="text-sm text-amber-800">
                You have <strong>{quotaRemaining} second{quotaRemaining !== 1 ? "s" : ""}</strong> of beta recording remaining. Your session will stop automatically when the limit is reached.
              </p>
            </div>
          )}

          {/* ── Start button ── */}
          <Button className="w-full gap-2" onClick={startRecording}>
            <PlayCircleIcon className="h-4 w-4" />
            Start recording
          </Button>

          {/* ── Privacy note ── */}
          <p className="text-xs text-gray-400 leading-relaxed px-1">
            Your recording is processed by AI and <strong className="text-gray-500">deleted immediately after scoring</strong> — never stored or shared. During beta, Gravitas may review transcripts (not recordings) to validate scoring accuracy.
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
              ) : elapsed >= quotaRemainingAtStartRef.current - 60 && elapsed < quotaRemainingAtStartRef.current ? (
                <p className="mt-1 text-xs text-amber-600">
                  {quotaRemainingAtStartRef.current - elapsed}s until beta limit — recording will stop automatically
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
              <p className="mt-2 text-xs text-gray-400 font-mono">
                Beta: {Math.floor((totalRecordingSeconds + elapsed) / 60)}m {((totalRecordingSeconds + elapsed) % 60).toString().padStart(2, "0")}s / 20m used
              </p>
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
        const dimNames = mode === "video"
          ? ["Articulation", "Projection", "Vocal Tone", "Vocal Steadiness", "Intonation", "Pace", "Pausing", "Breath Control", "Confidence Language", "Structure", "Conciseness", "Eye Contact", "Facial Expression", "Gestures", "Posture"]
          : ["Articulation", "Projection", "Vocal Tone", "Vocal Steadiness", "Intonation", "Pace", "Pausing", "Breath Control", "Confidence Language", "Structure", "Conciseness"];

        const estimateSecsRaw = mode === "video"
          ? Math.min(180, Math.round(90 + pendingDuration * 0.4))
          : Math.min(120, Math.round(60 + pendingDuration * 0.3));
        const estimateSecs = Math.ceil(estimateSecsRaw / 10) * 10;
        const estimateMins = Math.ceil(estimateSecs / 60);
        const estimateLabel = estimateSecs < 90
          ? `${estimateSecs} seconds`
          : `${estimateMins} minute${estimateMins > 1 ? "s" : ""}`;

        const stepLabel =
          processingStep === 0 ? "Uploading your recording…"
          : processingStep === 1 ? "Transcribing your speech…"
          : processingStep === 2 ? (mode === "video" ? "Analyzing delivery & presence…" : "Analyzing your delivery…")
          : "Generating your coaching feedback…";

        const litCount =
          processingStep <= 1 ? 0
          : processingStep === 2 ? Math.floor(dimNames.length * 0.55)
          : processingStep === 3 ? Math.floor(dimNames.length * 0.9)
          : dimNames.length;

        return (
          <div className="py-8 space-y-7">
            {/* Animated orb */}
            <div className="flex flex-col items-center gap-5 pt-2">
              <div className="relative flex items-center justify-center h-24 w-24">
                <div className="absolute h-24 w-24 rounded-full bg-[#F0953E]/10 animate-ping" style={{ animationDuration: "2.2s" }} />
                <div className="absolute h-16 w-16 rounded-full bg-[#F0953E]/15 animate-ping" style={{ animationDuration: "2.2s", animationDelay: "0.4s" }} />
                <div className="relative h-10 w-10 rounded-full bg-[#0F1B2D] flex items-center justify-center shadow-lg">
                  <div className="h-3 w-3 rounded-full bg-[#F0953E] animate-pulse" />
                </div>
              </div>
              <div className="text-center space-y-1.5">
                <p className="text-base font-semibold text-gray-900">{stepLabel}</p>
                <p className="text-xs text-gray-400">This may take {estimateLabel}</p>
                <p className="text-xs text-gray-400">You can close this tab — your results will be waiting in your history.</p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="space-y-1.5">
              <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#0F1B2D] transition-all duration-500 ease-out"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <p className="text-right text-xs text-gray-400 font-mono">{progressPct}%</p>
            </div>

            {/* Rotating insight */}
            <div className="rounded-xl border border-[#F0953E]/20 bg-[#FBF7F2] px-5 py-4 min-h-[80px] flex flex-col justify-center">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#C84A18] mb-1.5">Did you know</p>
              <p
                className="text-sm text-gray-700 leading-relaxed"
                style={{ opacity: insightFade ? 1 : 0, transition: "opacity 0.4s ease" }}
              >
                {INSIGHTS[insightIdx]}
              </p>
            </div>

            {/* Dimension chips */}
            {processingStep >= 2 && (
              <div className="space-y-2.5">
                <p className="text-xs text-gray-400">Dimensions being scored</p>
                <div className="flex flex-wrap gap-1.5">
                  {dimNames.map((name, i) => (
                    <span
                      key={name}
                      className="px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-300"
                      style={{
                        transitionDelay: `${i * 80}ms`,
                        backgroundColor: i < litCount ? "#0F1B2D" : "#F3F4F6",
                        color: i < litCount ? "white" : "#9CA3AF",
                      }}
                    >
                      {name}
                    </span>
                  ))}
                </div>
              </div>
            )}
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
