import OpenAI, { toFile } from "openai";
import { Buffer } from "node:buffer";
import { spawn } from "child_process";
import { writeFile, unlink, readFile } from "fs/promises";
import { randomUUID } from "crypto";
import { tmpdir } from "os";
import { join } from "path";

if (!process.env.AI_INTEGRATIONS_OPENAI_BASE_URL) {
  throw new Error(
    "AI_INTEGRATIONS_OPENAI_BASE_URL must be set. Did you forget to provision the OpenAI AI integration?",
  );
}

if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
  throw new Error(
    "AI_INTEGRATIONS_OPENAI_API_KEY must be set. Did you forget to provision the OpenAI AI integration?",
  );
}

export const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export type AudioFormat = "wav" | "mp3" | "webm" | "mp4" | "ogg" | "unknown";

/**
 * Detect audio format from buffer magic bytes.
 * Supports: WAV, MP3, WebM (Chrome/Firefox), MP4/M4A/MOV (Safari/iOS), OGG
 */
export function detectAudioFormat(buffer: Buffer): AudioFormat {
  if (buffer.length < 12) return "unknown";

  // WAV: RIFF....WAVE
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) {
    return "wav";
  }
  // WebM: EBML header
  if (buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) {
    return "webm";
  }
  // MP3: ID3 tag or frame sync
  if (
    (buffer[0] === 0xff && (buffer[1] === 0xfb || buffer[1] === 0xfa || buffer[1] === 0xf3)) ||
    (buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33)
  ) {
    return "mp3";
  }
  // MP4/M4A/MOV: ....ftyp (Safari/iOS records in these containers)
  if (buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70) {
    return "mp4";
  }
  // OGG: OggS
  if (buffer[0] === 0x4f && buffer[1] === 0x67 && buffer[2] === 0x67 && buffer[3] === 0x53) {
    return "ogg";
  }
  return "unknown";
}

/**
 * Convert any audio/video format to WAV using ffmpeg.
 */
export async function convertToWav(audioBuffer: Buffer): Promise<Buffer> {
  const inputPath = join(tmpdir(), `input-${randomUUID()}`);
  const outputPath = join(tmpdir(), `output-${randomUUID()}.wav`);

  try {
    await writeFile(inputPath, audioBuffer);

    await new Promise<void>((resolve, reject) => {
      const ffmpeg = spawn("ffmpeg", [
        "-i", inputPath,
        "-vn",
        "-f", "wav",
        "-ar", "16000",
        "-ac", "1",
        "-acodec", "pcm_s16le",
        "-y",
        outputPath,
      ]);

      ffmpeg.stderr.on("data", () => {});
      ffmpeg.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`ffmpeg exited with code ${code}`));
      });
      ffmpeg.on("error", reject);
    });

    return await readFile(outputPath);
  } finally {
    await unlink(inputPath).catch(() => {});
    await unlink(outputPath).catch(() => {});
  }
}

export type CompatibleFormat = "wav" | "mp3" | "webm" | "ogg" | "mp4";

/**
 * Auto-detect and convert audio to WAV (or MP3) for OpenAI APIs.
 * gpt-audio only accepts wav and mp3. Whisper accepts more formats but
 * we normalise everything to WAV for consistency.
 * ffmpeg is used for conversion; if unavailable the original buffer is
 * returned with its detected format as a best-effort fallback.
 */
export async function ensureCompatibleFormat(
  audioBuffer: Buffer
): Promise<{ buffer: Buffer; format: CompatibleFormat }> {
  const detected = detectAudioFormat(audioBuffer);

  // Already in an API-accepted format — no conversion needed
  if (detected === "wav") return { buffer: audioBuffer, format: "wav" };
  if (detected === "mp3") return { buffer: audioBuffer, format: "mp3" };

  // All other formats (webm, ogg, mp4, unknown) must be converted to WAV
  // because gpt-audio only accepts wav and mp3.
  try {
    console.log(`Audio format detected as "${detected}" — converting to WAV via ffmpeg`);
    const wavBuffer = await convertToWav(audioBuffer);
    console.log(`Audio converted to WAV successfully (${wavBuffer.length} bytes)`);
    return { buffer: wavBuffer, format: "wav" };
  } catch (err) {
    // ffmpeg unavailable or conversion failed — pass through and let the API
    // return its own error rather than silently dropping the recording.
    console.warn(`Audio conversion failed (${detected}):`, err);
    const fallback = (detected === "webm" || detected === "ogg" || detected === "mp4")
      ? detected
      : "webm";
    return { buffer: audioBuffer, format: fallback };
  }
}

// ─── Acoustic Metric Types ───────────────────────────────────────────────────

export interface RmsMetrics {
  meanRmsDb: number;
  rmsStdDb: number;
}

export interface F0Metrics {
  f0MinHz: number;
  f0MaxHz: number;
  f0StdHz: number;
  voicedFrameCount: number;
}

export interface PauseEvent {
  startSeconds: number;
  durationSeconds: number;
  isSentenceBoundary: boolean;
}

export interface PauseMetrics {
  pauseCount: number;
  avgPauseDurationSeconds: number;
  pauses: PauseEvent[];
}

// ─── WAV PCM helpers ─────────────────────────────────────────────────────────

/**
 * Read 16-bit signed PCM samples from a WAV buffer.
 * The standard PCM WAV header produced by ffmpeg (-acodec pcm_s16le) is 44 bytes.
 * We skip the header by scanning for the "data" chunk marker.
 */
function readPcmSamples(wavBuffer: Buffer): Int16Array {
  let dataOffset = 44;
  for (let i = 12; i < Math.min(wavBuffer.length - 8, 200); i++) {
    if (
      wavBuffer[i] === 0x64 && wavBuffer[i + 1] === 0x61 &&
      wavBuffer[i + 2] === 0x74 && wavBuffer[i + 3] === 0x61
    ) {
      dataOffset = i + 8;
      break;
    }
  }
  const pcmBytes = wavBuffer.slice(dataOffset);
  const sampleCount = Math.floor(pcmBytes.length / 2);
  const samples = new Int16Array(sampleCount);
  for (let i = 0; i < sampleCount; i++) {
    samples[i] = pcmBytes.readInt16LE(i * 2);
  }
  return samples;
}

// ─── RMS Amplitude Metrics ───────────────────────────────────────────────────

/**
 * Compute mean RMS amplitude (dBFS) and RMS standard deviation (dBFS) from
 * a normalised 16kHz mono PCM WAV buffer. Frames shorter than 20 ms or with
 * zero energy are skipped. dBFS is referenced to full-scale (±32768).
 */
export function computeRmsMetrics(wavBuffer: Buffer): RmsMetrics {
  const SAMPLE_RATE = 16000;
  const FRAME_SAMPLES = Math.round(SAMPLE_RATE * 0.02);
  const MIN_RMS_LINEAR = 1e-6;

  const samples = readPcmSamples(wavBuffer);
  const frameCount = Math.floor(samples.length / FRAME_SAMPLES);
  const frameDbValues: number[] = [];

  for (let f = 0; f < frameCount; f++) {
    const start = f * FRAME_SAMPLES;
    let sumSq = 0;
    for (let i = start; i < start + FRAME_SAMPLES; i++) {
      const s = samples[i] / 32768;
      sumSq += s * s;
    }
    const rmsLinear = Math.sqrt(sumSq / FRAME_SAMPLES);
    if (rmsLinear < MIN_RMS_LINEAR) continue;
    const rmsDb = 20 * Math.log10(rmsLinear);
    frameDbValues.push(rmsDb);
  }

  if (frameDbValues.length === 0) {
    return { meanRmsDb: -60, rmsStdDb: 0 };
  }

  const mean = frameDbValues.reduce((a, b) => a + b, 0) / frameDbValues.length;
  const variance = frameDbValues.reduce((a, b) => a + (b - mean) ** 2, 0) / frameDbValues.length;
  const std = Math.sqrt(variance);

  return {
    meanRmsDb: Math.round(mean * 10) / 10,
    rmsStdDb: Math.round(std * 10) / 10,
  };
}

// ─── F0 (Fundamental Frequency) Metrics ─────────────────────────────────────

/**
 * YIN pitch detection algorithm (de Cheveigné & Kawahara, 2002).
 * Returns the fundamental frequency in Hz for a mono float32 audio frame,
 * or null if no confident pitch is detected.
 * @param frame    Float32Array of audio samples normalised to [-1, 1]
 * @param sampleRate  Samples per second (e.g. 16000)
 * @param threshold   YIN threshold (0.10–0.20 typical; lower = stricter)
 */
function yinPitchHz(
  frame: Float32Array,
  sampleRate: number,
  threshold = 0.15
): number | null {
  const N = frame.length;
  const half = N >> 1;

  // Step 1 — difference function
  const diff = new Float32Array(half);
  for (let tau = 1; tau < half; tau++) {
    let sum = 0;
    for (let j = 0; j < half; j++) {
      const d = frame[j] - frame[j + tau];
      sum += d * d;
    }
    diff[tau] = sum;
  }

  // Step 2 — cumulative mean normalised difference function (CMNDF)
  const cmndf = new Float32Array(half);
  cmndf[0] = 1;
  let runningSum = 0;
  for (let tau = 1; tau < half; tau++) {
    runningSum += diff[tau];
    cmndf[tau] = runningSum === 0 ? 0 : diff[tau] * tau / runningSum;
  }

  // Step 3 — find first local minimum below threshold
  let tau = 2;
  while (tau < half - 1) {
    if (cmndf[tau] < threshold) {
      while (tau + 1 < half && cmndf[tau + 1] < cmndf[tau]) tau++;
      break;
    }
    tau++;
  }

  if (tau >= half - 1 || cmndf[tau] >= threshold) return null;

  // Step 4 — parabolic interpolation for sub-sample precision
  const x0 = tau > 1 ? tau - 1 : tau;
  const x2 = tau + 1 < half ? tau + 1 : tau;
  let betterTau: number;
  if (x0 === tau) {
    betterTau = cmndf[tau] <= cmndf[x2] ? tau : x2;
  } else if (x2 === tau) {
    betterTau = cmndf[tau] <= cmndf[x0] ? tau : x0;
  } else {
    const s0 = cmndf[x0];
    const s1 = cmndf[tau];
    const s2 = cmndf[x2];
    betterTau = tau + (s2 - s0) / (2 * (2 * s1 - s2 - s0));
  }

  return sampleRate / betterTau;
}

/**
 * Compute F0 min, max, and standard deviation in Hz across voiced segments.
 * Uses the YIN algorithm (pure TypeScript) on 16kHz mono 16-bit PCM WAV.
 * Only frames with detected pitch in the 60–500 Hz speech range are included.
 */
export function computeF0Metrics(wavBuffer: Buffer): F0Metrics {
  const SAMPLE_RATE = 16000;
  const FRAME_SAMPLES = 1024;
  const HOP_SAMPLES = 512;
  const MIN_PITCH_HZ = 60;
  const MAX_PITCH_HZ = 500;

  const samples = readPcmSamples(wavBuffer);

  const float32 = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    float32[i] = samples[i] / 32768;
  }

  const voicedPitches: number[] = [];

  for (let start = 0; start + FRAME_SAMPLES <= float32.length; start += HOP_SAMPLES) {
    const frame = float32.subarray(start, start + FRAME_SAMPLES);
    const pitch = yinPitchHz(frame as Float32Array, SAMPLE_RATE);
    if (pitch !== null && pitch >= MIN_PITCH_HZ && pitch <= MAX_PITCH_HZ) {
      voicedPitches.push(pitch);
    }
  }

  if (voicedPitches.length === 0) {
    return { f0MinHz: 0, f0MaxHz: 0, f0StdHz: 0, voicedFrameCount: 0 };
  }

  const min = Math.min(...voicedPitches);
  const max = Math.max(...voicedPitches);
  const mean = voicedPitches.reduce((a, b) => a + b, 0) / voicedPitches.length;
  const variance = voicedPitches.reduce((a, b) => a + (b - mean) ** 2, 0) / voicedPitches.length;
  const std = Math.sqrt(variance);

  return {
    f0MinHz: Math.round(min * 10) / 10,
    f0MaxHz: Math.round(max * 10) / 10,
    f0StdHz: Math.round(std * 10) / 10,
    voicedFrameCount: voicedPitches.length,
  };
}

// ─── Voice Chat: audio-in, audio-out using gpt-audio. ────────────────────────

/** Voice Chat: audio-in, audio-out using gpt-audio. */
export async function voiceChat(
  audioBuffer: Buffer,
  voice: "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer" = "alloy",
  inputFormat: "wav" | "mp3" = "wav",
  outputFormat: "wav" | "mp3" = "mp3"
): Promise<{ transcript: string; audioResponse: Buffer }> {
  const audioBase64 = audioBuffer.toString("base64");
  const response = await openai.chat.completions.create({
    model: "gpt-audio",
    modalities: ["text", "audio"],
    audio: { voice, format: outputFormat },
    messages: [{
      role: "user",
      content: [
        { type: "input_audio", input_audio: { data: audioBase64, format: inputFormat } },
      ],
    }],
  });
  const message = response.choices[0]?.message as any;
  const transcript = message?.audio?.transcript || message?.content || "";
  const audioData = message?.audio?.data ?? "";
  return {
    transcript,
    audioResponse: Buffer.from(audioData, "base64"),
  };
}

/** Streaming Voice Chat for real-time audio responses. */
export async function voiceChatStream(
  audioBuffer: Buffer,
  voice: "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer" = "alloy",
  inputFormat: "wav" | "mp3" = "wav"
): Promise<AsyncIterable<{ type: "transcript" | "audio"; data: string }>> {
  const audioBase64 = audioBuffer.toString("base64");
  const stream = await openai.chat.completions.create({
    model: "gpt-audio",
    modalities: ["text", "audio"],
    audio: { voice, format: "pcm16" },
    messages: [{
      role: "user",
      content: [
        { type: "input_audio", input_audio: { data: audioBase64, format: inputFormat } },
      ],
    }],
    stream: true,
  });

  return (async function* () {
    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta as any;
      if (!delta) continue;
      if (delta?.audio?.transcript) {
        yield { type: "transcript", data: delta.audio.transcript };
      }
      if (delta?.audio?.data) {
        yield { type: "audio", data: delta.audio.data };
      }
    }
  })();
}

/** Text-to-Speech using gpt-audio. */
export async function textToSpeech(
  text: string,
  voice: "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer" = "alloy",
  format: "wav" | "mp3" | "flac" | "opus" | "pcm16" = "wav"
): Promise<Buffer> {
  const response = await openai.chat.completions.create({
    model: "gpt-audio",
    modalities: ["text", "audio"],
    audio: { voice, format },
    messages: [
      { role: "system", content: "You are an assistant that performs text-to-speech." },
      { role: "user", content: `Repeat the following text verbatim: ${text}` },
    ],
  });
  const audioData = (response.choices[0]?.message as any)?.audio?.data ?? "";
  return Buffer.from(audioData, "base64");
}

/** Streaming Text-to-Speech. */
export async function textToSpeechStream(
  text: string,
  voice: "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer" = "alloy"
): Promise<AsyncIterable<string>> {
  const stream = await openai.chat.completions.create({
    model: "gpt-audio",
    modalities: ["text", "audio"],
    audio: { voice, format: "pcm16" },
    messages: [
      { role: "system", content: "You are an assistant that performs text-to-speech." },
      { role: "user", content: `Repeat the following text verbatim: ${text}` },
    ],
    stream: true,
  });

  return (async function* () {
    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta as any;
      if (!delta) continue;
      if (delta?.audio?.data) {
        yield delta.audio.data;
      }
    }
  })();
}

/** Speech-to-Text using gpt-4o-mini-transcribe. */
export async function speechToText(
  audioBuffer: Buffer,
  format: CompatibleFormat = "wav"
): Promise<string> {
  const file = await toFile(audioBuffer, `audio.${format}`);
  const response = await openai.audio.transcriptions.create({
    file,
    model: "gpt-4o-mini-transcribe",
  });
  return response.text;
}

/**
 * Speech-to-Text with segment + word timestamps.
 * Returns:
 * - text: full transcript
 * - speechDurationSeconds: first-word start → last-word end (strips leading/trailing silence)
 * - pauseMetrics: structured pause analysis derived from word-level gaps
 */
export async function speechToTextWithTiming(
  audioBuffer: Buffer,
  format: CompatibleFormat = "wav"
): Promise<{ text: string; speechDurationSeconds: number | null; pauseMetrics: PauseMetrics | null; wpmWindows: WpmWindow[] | null }> {
  const file = await toFile(audioBuffer, `audio.${format}`);
  try {
    const response = await openai.audio.transcriptions.create({
      file,
      model: "gpt-4o-mini-transcribe",
      response_format: "verbose_json",
      timestamp_granularities: ["segment", "word"],
    } as Parameters<typeof openai.audio.transcriptions.create>[0]);

    const r = response as unknown as {
      text: string;
      segments?: Array<{ start: number; end: number }>;
      words?: Array<{ word: string; start: number; end: number }>;
    };

    const text = r.text ?? "";
    const segments = r.segments ?? [];
    const words = r.words ?? [];

    let speechDurationSeconds: number | null = null;
    if (segments.length > 0) {
      const speechStart = segments[0].start;
      const speechEnd = segments[segments.length - 1].end;
      speechDurationSeconds = Math.max(1, speechEnd - speechStart);
    }

    const pauseMetrics = computePauseMetrics(words);
    const wpmWindows = words.length > 0 ? computeWpmWindows(words) : null;

    return { text, speechDurationSeconds, pauseMetrics, wpmWindows };
  } catch {
    // Fallback: plain transcription without timing
    const file2 = await toFile(audioBuffer, `audio.${format}`);
    const response = await openai.audio.transcriptions.create({
      file: file2,
      model: "gpt-4o-mini-transcribe",
    });
    return { text: response.text, speechDurationSeconds: null, pauseMetrics: null, wpmWindows: null };
  }
}

// ─── Windowed WPM ─────────────────────────────────────────────────────────────

export interface WpmWindow {
  /** Start of the window relative to the first spoken word (seconds). */
  windowStartSeconds: number;
  /** End of the window (seconds). */
  windowEndSeconds: number;
  /** Words spoken whose start timestamp falls inside this window. */
  wordCount: number;
  /** WPM for this window (wordCount / windowDuration * 60). */
  wpm: number;
}

/**
 * Slice word-level timestamps into fixed-width windows and compute WPM per window.
 * Words are bucketed by their `start` time, relative to the first word's start.
 * Windows that contain zero words are omitted.
 */
export function computeWpmWindows(
  words: Array<{ word: string; start: number; end: number }>,
  windowSeconds = 30
): WpmWindow[] {
  if (words.length === 0) return [];

  const origin = words[0].start;
  const relStart = (w: { start: number }) => w.start - origin;

  const buckets = new Map<number, number>();
  for (const w of words) {
    const bucket = Math.floor(relStart(w) / windowSeconds);
    buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1);
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a - b)
    .map(([bucket, wordCount]) => {
      const windowStartSeconds = bucket * windowSeconds;
      const windowEndSeconds = windowStartSeconds + windowSeconds;
      const wpm = Math.round((wordCount / windowSeconds) * 60);
      return { windowStartSeconds, windowEndSeconds, wordCount, wpm };
    });
}

// ─── Pause Analysis ───────────────────────────────────────────────────────────

const SENTENCE_BOUNDARY_RE = /[.?!,;:]$/;
const MIN_PAUSE_SECONDS = 0.5;

/**
 * Derive structured pause metrics from Whisper word-level timestamps.
 * A pause is any gap between consecutive words >= 0.5 s.
 * Sentence-boundary: the word preceding the gap ends with . ? ! , ; :
 */
function computePauseMetrics(
  words: Array<{ word: string; start: number; end: number }>
): PauseMetrics {
  if (words.length < 2) {
    return { pauseCount: 0, avgPauseDurationSeconds: 0, pauses: [] };
  }

  const pauses: PauseEvent[] = [];

  for (let i = 0; i < words.length - 1; i++) {
    const gap = words[i + 1].start - words[i].end;
    if (gap >= MIN_PAUSE_SECONDS) {
      pauses.push({
        startSeconds: Math.round(words[i].end * 100) / 100,
        durationSeconds: Math.round(gap * 100) / 100,
        isSentenceBoundary: SENTENCE_BOUNDARY_RE.test(words[i].word.trim()),
      });
    }
  }

  const avg =
    pauses.length > 0
      ? Math.round((pauses.reduce((s, p) => s + p.durationSeconds, 0) / pauses.length) * 100) / 100
      : 0;

  return {
    pauseCount: pauses.length,
    avgPauseDurationSeconds: avg,
    pauses,
  };
}

/** Streaming Speech-to-Text. */
export async function speechToTextStream(
  audioBuffer: Buffer,
  format: "wav" | "mp3" | "webm" = "wav"
): Promise<AsyncIterable<string>> {
  const file = await toFile(audioBuffer, `audio.${format}`);
  const stream = await openai.audio.transcriptions.create({
    file,
    model: "gpt-4o-mini-transcribe",
    stream: true,
  });

  return (async function* () {
    for await (const event of stream) {
      if (event.type === "transcript.text.delta") {
        yield event.delta;
      }
    }
  })();
}
