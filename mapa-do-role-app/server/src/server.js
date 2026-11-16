import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { rateLimit } from "express-rate-limit";
import { createServer as createHttpServer } from "node:http";
import { createServer as createHttpsServer } from "node:https";
import { readFileSync } from "node:fs";
import { config } from "./config.js";
import { pool } from "./db.js";
import authRoutes from "./routes/auth.js";
import privateDataRoutes from "./routes/privateData.js";
import { requireHttps } from "./middleware/security.js";
import { createRateLimitStore, redisClient, redisReady } from "./rateLimitStore.js";

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", config.TRUST_PROXY_HOPS);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      // Motion animates transform/opacity via inline style attributes.
      // Script execution remains restricted to same-origin bundles.
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'", config.webOrigin],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      frameAncestors: ["'none'"],
      formAction: ["'self'"]
    }
  }
}));

app.use(cors({
  origin(origin, callback) {
    // Requests without Origin are useful for health checks; browser auth
    // mutations still require the exact Origin in requireSameOrigin().
    if (!origin) return callback(null, false);
    return callback(null, origin === config.webOrigin ? origin : false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "OPTIONS"],
  allowedHeaders: ["Authorization", "Content-Type"],
  maxAge: 600
}));

app.use(requireHttps);
app.use(rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  store: createRateLimitStore("mdr:limit:api:")
}));
app.use(express.json({ limit: "16kb", strict: true }));
app.use(cookieParser());

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
app.use("/api/auth", authRoutes);
app.use("/api/me", privateDataRoutes);

app.use((_req, res) => res.status(404).json({ error: "not_found" }));
app.use((error, _req, res, _next) => {
  // Do not return stack traces, SQL errors, tokens, or submitted request bodies.
  console.error("API error:", error?.name || "UnknownError");
  const status = Number.isInteger(error?.status) && error.status >= 400 && error.status < 500
    ? error.status
    : 500;
  return res.status(status).json({
    error: status === 500 ? "internal_error" : "bad_request",
    message: status === 500 ? "Ocorreu um erro. Tente novamente." : "Requisição inválida."
  });
});

let server;
if (config.TLS_KEY_PATH && config.TLS_CERT_PATH) {
  server = createHttpsServer({
    key: readFileSync(config.TLS_KEY_PATH),
    cert: readFileSync(config.TLS_CERT_PATH),
    minVersion: "TLSv1.3"
  }, app);
} else {
  // Behind Nginx, keep this port private and set TRUST_PROXY_HOPS=1.
  // Nginx must enforce TLS 1.3 and overwrite X-Forwarded-* headers.
  server = createHttpServer(app);
}

await redisReady;
const listenHost = config.isProduction && config.TLS_KEY_PATH ? "0.0.0.0" : "127.0.0.1";
server.listen(config.PORT, listenHost, () => {
  console.info("Mapa do Rolê API pronta na porta " + config.PORT);
});

async function shutdown(signal) {
  console.info(signal + ": encerrando a API.");
  server.close(async () => {
    if (redisClient?.isOpen) await redisClient.quit();
    await pool.end();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
