const express = require("express");
const httpProxy = require("http-proxy");
const fs = require("fs");
const cors = require("cors");
require("dotenv").config();

const EnhancedLogger = require("./enhanced-logger");
const ErrorTracker = require("./error-tracker");
const AutoRollback = require("./auto-rollback");
const TriggerAgent = require("./agents/trigger-agent");

const { ingestLogs } = require("./rag/ingest");
const { retrieveRelevantLogs } = require("./rag/retriever");

const app = express();
const proxy = httpProxy.createProxyServer({});

// ================= INIT =================
const logger = new EnhancedLogger();
const errorTracker = new ErrorTracker(100);
const autoRollback = new AutoRollback(20);

const triggerAgent = new TriggerAgent(errorTracker, {
  errorThreshold: 20,
  minRequests: 20,
  cooldownMs: 60000,
});

// ================= MIDDLEWARE =================
app.use(express.json());
app.use(cors());

app.use((req, res, next) => {
  req.startTime = Date.now();
  next();
});

// ================= CONFIG =================
const getConfig = () => {
  try {
    return JSON.parse(fs.readFileSync("./config.json", "utf8"));
  } catch {
    return {
      mode: "stable",
      stable_url: "http://127.0.0.1:5001",
      test_url: "http://127.0.0.1:5002",
      canary_percent: 10,
    };
  }
};

const saveConfig = (config) => {
  fs.writeFileSync("./config.json", JSON.stringify(config, null, 2));
};

// ================= API ROUTES (MUST BE FIRST) =================

// STATS
app.get("/api/stats", (req, res) => {
  res.json(errorTracker.getStats());
});

// LOGS
app.get("/api/logs", (req, res) => {
  const logs = logger.getTodayLogs();
  res.json({ logs, count: logs?.length || 0 });
});

// CONFIG GET
app.get("/api/config", (req, res) => {
  res.json(getConfig());
});

// CONFIG UPDATE
app.post("/api/config", (req, res) => {
  const { mode } = req.body;

  if (!["stable", "test", "canary"].includes(mode)) {
    return res.status(400).json({ error: "Invalid mode" });
  }

  const config = getConfig();
  console.log("🚦 MODE CHANGE:", config.mode, "→", mode);

  config.mode = mode;
  saveConfig(config);

  res.json({
    success: true,
    mode,
  });
});

// ROLLBACK HISTORY
app.get("/api/rollback-history", (req, res) => {
  res.json({
    history: autoRollback.getRollbackHistory(),
    count: autoRollback.getRollbackHistory().length,
  });
});

// DEBUG INGEST
app.post("/api/debug/ingest", async (req, res) => {
  const logs = logger.getTodayLogs();

  const normalized = (logs || []).map((l) => ({
    statusCode: l.statusCode || l.status || 200,
    path: l.path || l.url || "unknown",
    responseBody: l.responseBody || l.body || null,
  }));

  await ingestLogs(normalized);

  res.json({ success: true, ingested: normalized.length });
});

// ANALYZE
app.post("/api/analyze", async (req, res) => {
  try {
    const stats = errorTracker.getStats();
    const errorRate = parseFloat(stats.errorRatePercent || 0);

    let relevantLogs = [];

    try {
      relevantLogs = await retrieveRelevantLogs(
        "errors failures crashes 500 502 503 504 timeout"
      );
    } catch (err) {
      console.error("[RAG ERROR]", err.message);
    }

    if (!relevantLogs?.length) {
      relevantLogs = (logger.getTodayLogs() || []).slice(-5);
    }

    const prompt = `
Analyze backend logs:

${relevantLogs
  .map(
    (l) =>
      `Status:${l.statusCode} Path:${l.path} Msg:${
        l.responseBody?.message || l.responseBody || "Unknown"
      }`
  )
  .join("\n")}

Error Rate: ${errorRate}%

Explain clearly:
- root cause
- impact
- fix
- prevention
`;

    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.3,
        }),
      }
    );

    const data = await response.json();

    res.json({
      result: data.choices?.[0]?.message?.content || "AI failed",
    });
  } catch (err) {
    console.error("[ANALYZE ERROR]", err.message);
    res.status(500).json({ error: "Analysis failed" });
  }
});

// ================= PROXY (ONLY NON-API TRAFFIC) =================
app.use((req, res, next) => {
  if (req.path.startsWith("/api")) return next(); // 🔥 CRITICAL FIX

  const config = getConfig();

  let target =
    config.mode === "test"
      ? config.test_url
      : config.mode === "canary"
      ? Math.random() * 100 < config.canary_percent
        ? config.test_url
        : config.stable_url
      : config.stable_url;

  proxy.web(req, res, { target });

  res.on("finish", async () => {
    const duration = Date.now() - req.startTime;

    logger.logRequest(
      req,
      res,
      duration,
      target,
      res.statusCode,
      req.responseBody
    );

    errorTracker.addRequest(res.statusCode);

    if (res.statusCode >= 400) {
      const logEntry = {
        statusCode: res.statusCode,
        path: req.path,
        responseBody: req.responseBody || null,
      };

      Promise.resolve()
        .then(() => ingestLogs([logEntry]))
        .catch((e) => console.error("[INGEST ERROR]", e.message));
    }

    try {
      await triggerAgent.observe({
        statusCode: res.statusCode,
        path: req.path,
        responseBody: req.responseBody,
      });
    } catch (e) {
      console.error("[AGENT ERROR]", e.message);
    }
  });
});

// ================= PROXY ERROR =================
proxy.on("error", (err, req, res) => {
  console.error("[PROXY ERROR]", err.message);
  if (!res.headersSent) {
    res.status(502).json({ error: "Bad Gateway" });
  }
});

// ================= START =================
app.listen(4000, () => {
  console.log("🚀 Server running on http://localhost:4000");
  console.log("🤖 Agentic AI + Auto Rollback ACTIVE");
});