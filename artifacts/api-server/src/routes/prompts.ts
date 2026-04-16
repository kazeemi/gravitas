import { Router } from "express";
import { requireAuth } from "../lib/auth.js";

const PROMPTS = [
  {
    id: "p1",
    type: "persuasion",
    text: "Convince a skeptical executive that your team needs additional headcount.",
    recommendedDurationSeconds: 90,
  },
  {
    id: "p2",
    type: "vision",
    text: "Describe your vision for how your team or department will look in three years.",
    recommendedDurationSeconds: 120,
  },
  {
    id: "p3",
    type: "feedback",
    text: "Deliver constructive feedback to a high-performing team member who missed a deadline.",
    recommendedDurationSeconds: 90,
  },
  {
    id: "p4",
    type: "crisis",
    text: "Address your team after a major project setback and outline the path forward.",
    recommendedDurationSeconds: 120,
  },
  {
    id: "p5",
    type: "introduction",
    text: "Introduce yourself to a new stakeholder group and establish your credibility.",
    recommendedDurationSeconds: 60,
  },
  {
    id: "p6",
    type: "data",
    text: "Present three key findings from a recent analysis to non-technical leadership.",
    recommendedDurationSeconds: 90,
  },
  {
    id: "p7",
    type: "negotiation",
    text: "Negotiate a project scope change with a client who is resistant to adjustments.",
    recommendedDurationSeconds: 90,
  },
  {
    id: "p8",
    type: "inspiration",
    text: "Motivate your team at the start of a challenging quarter with high expectations.",
    recommendedDurationSeconds: 60,
  },
];

const router = Router();

router.get("/v1/prompts", requireAuth, (req, res) => {
  const { type } = req.query;
  const prompts = type ? PROMPTS.filter(p => p.type === type) : PROMPTS;
  res.json({ prompts });
});

router.get("/v1/prompts/random", requireAuth, (req, res) => {
  const { type } = req.query;
  const pool = type ? PROMPTS.filter(p => p.type === type) : PROMPTS;
  const prompt = pool[Math.floor(Math.random() * pool.length)];
  res.json(prompt);
});

export default router;
