import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import path from "path";
import fs from "fs";
import router from "./routes/index.js";
import { logger } from "./lib/logger.js";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "accounts.google.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "fonts.googleapis.com"],
      fontSrc: ["'self'", "fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'"],
      mediaSrc: ["'self'", "blob:"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map(o => o.trim())
  : ["http://localhost:5173", "http://localhost:5174", "http://localhost:4173"];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: origin ${origin} not allowed`));
    }
  },
  credentials: true,
}));

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use("/api", router);

// Serve static frontends when built (production).
// Admin dashboard at /admin, ep-app at /.
// __dirname is set by the esbuild banner to the compiled dist/ directory.
const adminDist = path.resolve(__dirname, "../../admin/dist/public");
if (fs.existsSync(adminDist)) {
  app.use("/admin", express.static(adminDist));
  app.use("/admin", (_req: Request, res: Response) => {
    res.sendFile(path.join(adminDist, "index.html"));
  });
}

const epAppDist = path.resolve(__dirname, "../../ep-app/dist/public");
if (fs.existsSync(epAppDist)) {
  app.use(express.static(epAppDist));
  app.use((_req: Request, res: Response) => {
    res.sendFile(path.join(epAppDist, "index.html"));
  });
}

// Global error handler — always returns JSON so the client never receives an HTML 500 page.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  const message = err instanceof Error ? err.message : "Internal server error";
  req.log?.error({ err }, "Unhandled error");
  res.status(500).json({ error: message });
});

export default app;
