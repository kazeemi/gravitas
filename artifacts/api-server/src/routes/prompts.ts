import { Router } from "express";
import { requireAuth } from "../lib/auth.js";

export interface Prompt {
  id: string;
  category: string;
  context: string;
  text: string;
  recommendedDurationSeconds: number;
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
    text: "Answer the question: \"Tell me about a time you led through significant uncertainty.\"",
    recommendedDurationSeconds: 120,
  },
  {
    id: "p20",
    category: "Interview",
    context: "Impromptu",
    text: "Answer the question: \"What is your leadership philosophy and how have you applied it?\"",
    recommendedDurationSeconds: 120,
  },
  {
    id: "p21",
    category: "Interview",
    context: "Impromptu",
    text: "Answer the question: \"What is your greatest professional achievement and why?\"",
    recommendedDurationSeconds: 120,
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
];

export function getPromptContext(promptText: string): string | undefined {
  return PROMPTS.find(p => p.text === promptText)?.context;
}

const router = Router();

router.get("/v1/prompts", requireAuth, (req, res) => {
  const { category } = req.query;
  const prompts = category
    ? PROMPTS.filter(p => p.category === category)
    : PROMPTS;
  res.json({ prompts });
});

router.get("/v1/prompts/random", requireAuth, (req, res) => {
  const { category } = req.query;
  const pool = category
    ? PROMPTS.filter(p => p.category === category)
    : PROMPTS;
  const prompt = pool[Math.floor(Math.random() * pool.length)];
  res.json(prompt);
});

export default router;
