// Verifies the model does not cite a transcription-loop artifact as evidence of
// a real stumble unless the audio evidence independently corroborates it.
//
// This is the bug reported directly by a user: the transcript looped on "the
// development team for the development team for the development team" — a
// phrase they never said — and the feedback coached them on it as a loss of
// thread.
//
//   node scripts/test-transcript-loop-guardrail.mjs

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const env = readFileSync(join(here, "..", ".env.local"), "utf8");
const key = env.match(/^\s*CLAUDE_API_KEY\s*=\s*(.+)$/m)[1].trim().replace(/^["']|["']$/g, "");

const RULE = `TRANSCRIPT LOOPING — CRITICAL: Automatic transcription occasionally loops, producing an exact or near-exact repeated phrase that the speaker never actually said — a transcription artifact, not a disfluency. Before citing ANY repeated word or phrase as evidence of a stumble, self-correction, or loss of thread, check the audio delivery analysis: only report it as real if that analysis independently corroborates a stumble or restart at that point. If it says nothing about it, do not mention the repetition at all.`;

const LOOPED_TRANSCRIPT =
  "I lead our operations team, and this quarter we reduced delivery times by working closely with " +
  "the development team for the development team for the development team on process improvements.";

const CASES = [
  {
    name: "A. loop with NO corroboration — must be ignored",
    audioAnalysis: "Delivery is steady and controlled throughout. No stumbles, restarts, or hesitations detected.",
    mustNotMention: true,
  },
  {
    name: "B. loop WITH corroboration — real stumble may be reported",
    audioAnalysis: "A brief stumble is audible partway through: the speaker restarts the phrase \"the development team\" twice before continuing, with a short pause each time.",
    mustNotMention: false,
  },
];

async function run(audioAnalysis) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 400,
      messages: [
        {
          role: "user",
          content: `You are an executive presence coach writing feedback on structure and flow.\n\n${RULE}\n\nSOURCE A — audio delivery analysis:\n${audioAnalysis}\n\nSOURCE C — transcript:\n"${LOOPED_TRANSCRIPT}"\n\nWrite one paragraph of feedback on structure/flow. Return ONLY JSON: {"feedback": "..."}`,
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = ((await res.json()).content ?? []).filter((b) => b.type === "text").map((b) => b.text).join("");
  const m = text.match(/\{[\s\S]*\}/);
  return JSON.parse(m[0]).feedback;
}

let failures = 0;
for (const c of CASES) {
  const feedback = await run(c.audioAnalysis);
  const mentionsLoop = /development team.*development team/i.test(feedback) || /repeated phrase|loss of thread|stumbl|restart/i.test(feedback);
  const ok = c.mustNotMention ? !mentionsLoop : true; // case B just documents behavior, doesn't hard-fail
  console.log(`\n${c.name}`);
  console.log(`  feedback: ${feedback}`);
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${c.mustNotMention ? "does not fabricate a stumble from the transcript alone" : "(informational — corroborated case)"}`);
  if (!ok) failures++;
}

console.log(failures === 0 ? "\nGuardrail holds: uncorroborated transcript loops are not cited as real disfluencies." : `\n${failures} check(s) FAILED.`);
process.exitCode = failures === 0 ? 0 : 1;
