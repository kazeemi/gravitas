import { Router } from "express";
import { requireAuth } from "../lib/auth.js";

export interface Prompt {
  id: string;
  category: string;
  context: string;
  text: string;
  recommendedDurationSeconds: number;
  sector?: string;
}

export const PROMPTS: Prompt[] = [
  {
    id: "p1",
    category: "Introduction",
    context: "Stakeholder Update",
    text: "Introduce yourself to a new stakeholder group and establish your credibility.",
    recommendedDurationSeconds: 60,
  },
  {
    id: "p2",
    category: "Introduction",
    context: "Stakeholder Update",
    text: "You are at a senior networking event. Someone asks what you do. Make it compelling.",
    recommendedDurationSeconds: 60,
  },
  {
    id: "p3",
    category: "Persuasion",
    context: "Formal Presentation",
    text: "Convince a sceptical executive that your team needs additional headcount.",
    recommendedDurationSeconds: 90,
  },
  {
    id: "p4",
    category: "Persuasion",
    context: "Formal Presentation",
    text: "Pitch an idea you believe in to a room that has not asked for it and may be sceptical.",
    recommendedDurationSeconds: 90,
  },
  {
    id: "p5",
    category: "Persuasion",
    context: "Stakeholder Update",
    text: "Make the case to your manager for why you should lead an upcoming high-visibility project.",
    recommendedDurationSeconds: 90,
  },
  {
    id: "p6",
    category: "Vision",
    context: "Formal Presentation",
    text: "Describe your vision for how your team or department will look in three years.",
    recommendedDurationSeconds: 120,
  },
  {
    id: "p7",
    category: "Vision",
    context: "Stakeholder Update",
    text: "Describe where you want to be professionally in three years and what you are doing to get there.",
    recommendedDurationSeconds: 120,
  },
  {
    id: "p8",
    category: "Feedback",
    context: "Difficult Conversation",
    text: "Deliver constructive feedback to a high-performing team member who missed a critical deadline.",
    recommendedDurationSeconds: 90,
  },
  {
    id: "p9",
    category: "Difficult Conversation",
    context: "Difficult Conversation",
    text: "Inform a senior colleague that their behaviour in a recent meeting undermined the team.",
    recommendedDurationSeconds: 90,
  },
  {
    id: "p10",
    category: "Difficult Conversation",
    context: "Difficult Conversation",
    text: "Push back on a decision made by someone more senior than you, respectfully and clearly.",
    recommendedDurationSeconds: 90,
  },
  {
    id: "p11",
    category: "Crisis",
    context: "Formal Presentation",
    text: "Address your team after a major project setback and outline the path forward.",
    recommendedDurationSeconds: 120,
  },
  {
    id: "p12",
    category: "Data",
    context: "Formal Presentation",
    text: "Present three key findings from a recent analysis to a non-technical leadership team.",
    recommendedDurationSeconds: 90,
  },
  {
    id: "p13",
    category: "Data",
    context: "Stakeholder Update",
    text: "Explain a complex idea in your field to someone who knows nothing about it.",
    recommendedDurationSeconds: 90,
  },
  {
    id: "p14",
    category: "Negotiation",
    context: "Difficult Conversation",
    text: "Negotiate a scope change with a client who is resistant to adjustments.",
    recommendedDurationSeconds: 90,
  },
  {
    id: "p15",
    category: "Inspiration",
    context: "High Energy",
    text: "Motivate your team at the start of a challenging quarter with high expectations.",
    recommendedDurationSeconds: 90,
  },
  {
    id: "p16",
    category: "Stakeholder Update",
    context: "Stakeholder Update",
    text: "Brief your board on the current status of a high-priority initiative, including one risk you are actively managing.",
    recommendedDurationSeconds: 90,
  },
  {
    id: "p17",
    category: "Stakeholder Update",
    context: "Stakeholder Update",
    text: "Update a sceptical client on a project that has fallen behind schedule.",
    recommendedDurationSeconds: 90,
  },
  {
    id: "p18",
    category: "Stakeholder Update",
    context: "Stakeholder Update",
    text: "Update your manager on a project that has hit an unexpected obstacle.",
    recommendedDurationSeconds: 90,
  },
  {
    id: "p19",
    category: "Interview",
    context: "Impromptu",
    text: "Tell me about a time you led through significant uncertainty.",
    recommendedDurationSeconds: 120,
    sector: "all",
  },
  {
    id: "p20",
    category: "Interview",
    context: "Impromptu",
    text: "What is your leadership philosophy and how have you applied it?",
    recommendedDurationSeconds: 120,
    sector: "all",
  },
  {
    id: "p21",
    category: "Interview",
    context: "Impromptu",
    text: "What is your greatest professional achievement and why?",
    recommendedDurationSeconds: 120,
    sector: "all",
  },
  {
    id: "p22",
    category: "Impromptu",
    context: "Impromptu",
    text: "You have just been asked, without warning, to share your perspective on your organisation's biggest strategic risk. No preparation. Begin now.",
    recommendedDurationSeconds: 90,
  },
  {
    id: "p23",
    category: "Impromptu",
    context: "Impromptu",
    text: "A senior leader has just asked you to summarise — in two minutes — why your project deserves continued investment. You have 10 seconds to collect your thoughts.",
    recommendedDurationSeconds: 120,
  },
  {
    id: "p24",
    category: "Impromptu",
    context: "Impromptu",
    text: "You have been asked to speak for 90 seconds on the most important lesson your career has taught you. No preparation.",
    recommendedDurationSeconds: 90,
  },

  // ── Consulting behavioral interview questions ──────────────────────────────
  {
    id: "p25",
    category: "Interview",
    context: "Impromptu",
    text: "Tell me about a time you had to rapidly get up to speed on an unfamiliar industry and still deliver meaningful insights.",
    recommendedDurationSeconds: 120,
    sector: "consulting",
  },
  {
    id: "p26",
    category: "Interview",
    context: "Impromptu",
    text: "Describe a situation where you had to persuade a skeptical senior stakeholder to accept a recommendation they initially resisted.",
    recommendedDurationSeconds: 120,
    sector: "consulting",
  },
  {
    id: "p27",
    category: "Interview",
    context: "Impromptu",
    text: "Tell me about a time you led a team through significant ambiguity, with no clear playbook or prior precedent.",
    recommendedDurationSeconds: 120,
    sector: "consulting",
  },
  {
    id: "p28",
    category: "Interview",
    context: "Impromptu",
    text: "Describe a project where you had to manage competing client priorities with limited time and resources. How did you handle it?",
    recommendedDurationSeconds: 120,
    sector: "consulting",
  },
  {
    id: "p29",
    category: "Interview",
    context: "Impromptu",
    text: "Tell me about a time you delivered an unpopular recommendation. How did you communicate it and handle the pushback?",
    recommendedDurationSeconds: 120,
    sector: "consulting",
  },
  {
    id: "p30",
    category: "Interview",
    context: "Impromptu",
    text: "Describe a situation where your analysis fundamentally changed the direction of a project or client engagement.",
    recommendedDurationSeconds: 120,
    sector: "consulting",
  },
  {
    id: "p31",
    category: "Interview",
    context: "Impromptu",
    text: "Tell me about a time you worked under extreme time pressure to deliver a high-quality output. What trade-offs did you make?",
    recommendedDurationSeconds: 120,
    sector: "consulting",
  },

  // ── Banking & Finance behavioral interview questions ───────────────────────
  {
    id: "p32",
    category: "Interview",
    context: "Impromptu",
    text: "Tell me about a time you had to make a high-stakes decision under significant time pressure. What was your process?",
    recommendedDurationSeconds: 120,
    sector: "banking",
  },
  {
    id: "p33",
    category: "Interview",
    context: "Impromptu",
    text: "Describe a situation where you identified a critical risk before others did and how you acted on it.",
    recommendedDurationSeconds: 120,
    sector: "banking",
  },
  {
    id: "p34",
    category: "Interview",
    context: "Impromptu",
    text: "Tell me about the most complex deal, transaction, or financial analysis you have worked on. What was your role?",
    recommendedDurationSeconds: 120,
    sector: "banking",
  },
  {
    id: "p35",
    category: "Interview",
    context: "Impromptu",
    text: "Describe a time when you had to manage multiple competing high-priority deadlines simultaneously. How did you prioritise?",
    recommendedDurationSeconds: 120,
    sector: "banking",
  },
  {
    id: "p36",
    category: "Interview",
    context: "Impromptu",
    text: "Tell me about a time you worked in a highly competitive team environment. How did you contribute and differentiate yourself?",
    recommendedDurationSeconds: 120,
    sector: "banking",
  },
  {
    id: "p37",
    category: "Interview",
    context: "Impromptu",
    text: "Describe a situation where you had to balance rigorous analysis with the speed of delivery. What was the outcome?",
    recommendedDurationSeconds: 120,
    sector: "banking",
  },
  {
    id: "p38",
    category: "Interview",
    context: "Impromptu",
    text: "Tell me about a time you had to present complex financial or technical information to a non-specialist audience. How did you approach it?",
    recommendedDurationSeconds: 120,
    sector: "banking",
  },

  // ── Tech behavioral interview questions ───────────────────────────────────
  {
    id: "p39",
    category: "Interview",
    context: "Impromptu",
    text: "Tell me about a time you built or launched something from scratch with limited resources or guidance.",
    recommendedDurationSeconds: 120,
    sector: "tech",
  },
  {
    id: "p40",
    category: "Interview",
    context: "Impromptu",
    text: "Describe a situation where you had to influence a major decision without formal authority. How did you get buy-in?",
    recommendedDurationSeconds: 120,
    sector: "tech",
  },
  {
    id: "p41",
    category: "Interview",
    context: "Impromptu",
    text: "Tell me about a time you used data to drive a significant decision or fundamentally change the direction of a project.",
    recommendedDurationSeconds: 120,
    sector: "tech",
  },
  {
    id: "p42",
    category: "Interview",
    context: "Impromptu",
    text: "Describe a project where you had to make difficult trade-offs under constraints of time, scope, or resources. What did you choose and why?",
    recommendedDurationSeconds: 120,
    sector: "tech",
  },
  {
    id: "p43",
    category: "Interview",
    context: "Impromptu",
    text: "Tell me about a time you shipped something quickly and then iterated based on real feedback. What changed and what did you learn?",
    recommendedDurationSeconds: 120,
    sector: "tech",
  },
  {
    id: "p44",
    category: "Interview",
    context: "Impromptu",
    text: "Describe a situation where you failed to hit a goal or ship something you committed to. What happened and what did you do differently?",
    recommendedDurationSeconds: 120,
    sector: "tech",
  },
  {
    id: "p45",
    category: "Interview",
    context: "Impromptu",
    text: "Tell me about a time you had to align stakeholders with conflicting priorities around a single decision. How did you resolve it?",
    recommendedDurationSeconds: 120,
    sector: "tech",
  },
];

export function getPromptContext(promptText: string): string | undefined {
  return PROMPTS.find(p => p.text === promptText)?.context;
}

const router = Router();

router.get("/v1/prompts", requireAuth, (req, res) => {
  const { category, sector } = req.query;
  let prompts = PROMPTS;
  if (category) prompts = prompts.filter(p => p.category === category);
  if (sector) prompts = prompts.filter(p => p.sector === sector || p.sector === "all");
  res.json({ prompts });
});

router.get("/v1/prompts/random", requireAuth, (req, res) => {
  const { category, sector } = req.query;
  let pool = PROMPTS;
  if (category) pool = pool.filter(p => p.category === category);
  if (sector) pool = pool.filter(p => p.sector === sector || p.sector === "all");
  const prompt = pool[Math.floor(Math.random() * pool.length)];
  res.json(prompt);
});

export default router;
