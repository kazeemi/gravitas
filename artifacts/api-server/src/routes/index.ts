import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import usersRouter from "./users.js";
import sessionsRouter from "./sessions.js";
import promptsRouter from "./prompts.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(usersRouter);
router.use(sessionsRouter);
router.use(promptsRouter);

export default router;
