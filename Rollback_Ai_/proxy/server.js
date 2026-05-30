
const express = require("express");
const httpProxy = require("http-proxy");
const fs = require("fs");
const cors = require("cors");
require("dotenv").config();

const EnhancedLogger = require("./enhanced-logger");
const ErrorTracker = require("./error-tracker");
const AutoRollback = require("./auto-rollback");

const { ingestLogs } = require("./rag/ingest");
const { retrieveRelevantLogs } = require("./rag/retriever");
const { runPatchAgent } = require("./agents/patch-agent");
const { applyPatch } = require("./agents/patch-executor");
const { createCheckpoint } = require("./utils/git-checkpoint");
const TriggerAgent = require("./agents/trigger-agent");
const { runAnalysisAgent } = require("./agents/analysis-agent");
const { getAIState } = require("./agents/ai-state");

const app = express();
const proxy = httpProxy.createProxyServer({});

// ================= INIT =================
const logger = new EnhancedLogger();
const errorTracker = new ErrorTracker(100);
const autoRollback = new AutoRollback(20);
const { scanNetwork, diagnoseLogWatchNetwork, classifyNetworkRelatedErrors } = require("./network-scanner");
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

// ================= PATCH VALIDATION =================
function isValidPatch(patch) {
  if (!patch?.file || !patch?.replacement) return false;
  if (typeof patch.replacement !== "string") return false;
  if (patch.replacement.includes("TODO")) return false;
  if (patch.replacement.trim().length < 20) return false;
  return true;
}

// ================= ROUTES =================

// stats
app.get("/api/stats", (req, res) => {
  res.json(errorTracker.getStats());
});

// logs
app.get("/api/logs", (req, res) => {
  const logs = logger.getTodayLogs();
  res.json({ logs, count: logs?.length || 0 });
});

// config
app.get("/api/config", (req, res) => {
  res.json(getConfig());
});

app.post("/api/config", (req, res) => {
  const { mode } = req.body;

  if (!["stable", "test", "canary"].includes(mode)) {
    return res.status(400).json({ error: "Invalid mode" });
  }

  const config = getConfig();
  config.mode = mode;
  saveConfig(config);

  res.json({ success: true });
});

// rollback history
app.get("/api/rollback-history", (req, res) => {
  try {
    const history = autoRollback.getRollbackHistory();

    res.json({
      success: true,
      count: history.length,
      history,
    });
  } catch (err) {
    console.error("[ROLLBACK HISTORY ERROR]", err.message);
    res.status(500).json({ error: "Failed to fetch rollback history" });
  }
});

// ================= AI STATE =================
app.get("/api/ai/state", (req, res) => {
  res.json({
    success: true,
    data: getAIState(),
  });
});

// ================= DEBUG INGEST =================
app.post("/api/debug/ingest", async (req, res) => {
  const logs = logger.getTodayLogs();

  const normalized = (logs || []).map((l) => ({
    statusCode: l.statusCode || l.status || 200,
    path: l.path || l.url || "unknown",
    responseBody: l.responseBody || l.body || null,
  }));

  try {
    await ingestLogs(normalized);
  } catch (err) {
    console.error("[INGEST ERROR]", err.message);
  }

  res.json({ success: true, ingested: normalized.length });
});

// ================= ANALYZE (SAFE PATCH FLOW) =================
// ================= ANALYZE (SAFE PATCH FLOW) =================
app.post("/api/analyze", async (req, res) => {
  try {
    const stats = errorTracker.getStats();
    const errorRate = parseFloat(stats.errorRatePercent || stats.errorRate || 0);

    // ✅ Guard: nothing to analyze yet
    if (!stats.totalRequests || stats.totalRequests === 0) {
      return res.json({
        success: true,
        data: {
          recommendation: "No requests logged yet. Send some traffic first.",
          risk: "LOW",
          errors: [],
          summary: "System is idle.",
        },
        patch: null,
      });
    }

    // ================= 1. ANALYSIS =================
    let analysis;
    try {
      analysis = await runAnalysisAgent({ errorRate, stats });
    } catch (err) {
      console.error("[ANALYSIS AGENT ERROR]", err.message);
      // ✅ Return degraded response instead of 500
      return res.json({
        success: true,
        data: {
          recommendation: "AI analysis unavailable. Check Groq API key or network.",
          risk: errorRate > 25 ? "HIGH" : "LOW",
          errors: [],
          summary: `Error rate is ${errorRate.toFixed(1)}%. Manual review recommended.`,
        },
        patch: null,
      });
    }

    // ================= 2. PATCH GENERATION =================
    let patch = null;
    try {
      patch = await runPatchAgent({ analysis, stats });
    } catch (err) {
      console.error("[PATCH AGENT ERROR]", err.message);
      // ✅ Patch failure is non-fatal, continue without it
    }

    // ================= 3. APPLY PATCH SAFELY =================
    if (patch?.file) {
      console.log("🧠 Patch generated for:", patch.file);
      if (!isValidPatch(patch)) {
        console.log("❌ Invalid patch rejected");
        return res.json({ success: true, data: analysis, patch: null });
      }
      try {
        createCheckpoint();
        applyPatch(patch);
        console.log("🩹 Patch applied successfully");
      } catch (err) {
        console.error("[PATCH APPLY ERROR]", err.message);
        patch = null; // ✅ Don't crash, just skip patch
      }
    }

    res.json({
      success: true,
      data: analysis,
      patch: patch ? { file: patch.file, applied: true } : null,
    });

  } catch (err) {
    console.error("[ANALYZE ERROR]", err.message);
    // ✅ Last resort — still return 200 with error info, not 500
    res.json({
      success: false,
      data: {
        recommendation: "Analysis failed unexpectedly.",
        risk: "UNKNOWN",
        errors: [],
        summary: err.message,
      },
      patch: null,
    });
  }
});

// ================= PROXY RESPONSE CAPTURE =================
proxy.on("proxyRes", (proxyRes, req) => {
  let body = [];

  proxyRes.on("data", (chunk) => body.push(chunk));

  proxyRes.on("end", () => {
    try {
      const raw = Buffer.concat(body).toString();
      req.responseBody = JSON.parse(raw);
    } catch {
      req.responseBody = Buffer.concat(body).toString();
    }
  });
});

app.post("/api/network/scan", async (req, res) => {
  try {
    const result = await scanNetwork({
      target: req.body?.target,
      profile: req.body?.profile,
    });

    res.json({ success: true, data: result });
  } catch (err) {
    res.status(err.statusCode || 500).json({
      success: false,
      error: err.message,
    });
  }
});

app.post("/api/network/diagnose", async (req, res) => {
  try {
    const target = req.body?.target || "127.0.0.1";
    const networkDiagnosis = await diagnoseLogWatchNetwork(target);
    const stats = errorTracker.getStats();
    const config = getConfig();
    const logs = logger.getTodayLogs();
    const services = networkDiagnosis.services;
    const networkIssues = networkDiagnosis.networkIssues;
    const appErrors = logs.filter((log) => Number(log.statusCode) >= 400);
    const dependencyFindings = classifyNetworkRelatedErrors(logs);

    let diagnosis;
    if (networkIssues.length > 0) {
      diagnosis = `Network issue: ${networkIssues.map((service) => `${service.name} port ${service.port}`).join(", ")} not reachable.`;
    } else if (dependencyFindings.length > 0) {
      diagnosis = `All LogWatch ports are reachable, but ${dependencyFindings.length} network-related error type(s) were found in backend responses.`;
    } else if (appErrors.length > 0) {
      diagnosis = `Network ports are reachable. Current failures look application/backend related: ${appErrors.length} logged errors.`;
    } else {
      diagnosis = "Network ports are reachable and no current application errors are logged.";
    }

    res.json({
      success: true,
      data: {
        target,
        mode: config.mode,
        errorRate: stats.errorRate,
        totalErrors: stats.totalErrors,
        services,
        dependencyFindings,
        diagnosis,
        scan: networkDiagnosis.scan,
      },
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({
      success: false,
      error: err.message,
    });
  }
});


// ================= PROXY =================
app.use((req, res) => {
  const config = getConfig();

  const target =
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

    const stats = errorTracker.getStats();
    const errorRate = parseFloat(
      stats.errorRatePercent || stats.errorRate || 0
    );

    console.log("📊 Error Rate:", errorRate);

    // ingest logs
    if (res.statusCode >= 400) {
      const logEntry = {
        statusCode: res.statusCode,
        path: req.path,
        responseBody: req.responseBody || null,
      };

      try {
        await ingestLogs([logEntry]);
      } catch (err) {
        console.error("[INGEST ERROR]", err.message);
      }
    }

    // trigger agent
    try {
      await triggerAgent.observe({
        statusCode: res.statusCode,
        path: req.path,
        responseBody: req.responseBody,
        errorRate,
        autoRollback,
      });
    } catch (e) {
      console.error("[AGENT ERROR]", e.message);
    }
  });
});





// ================= ERROR =================
proxy.on("error", (err, req, res) => {
  console.error("[PROXY ERROR]", err.message);
  if (!res.headersSent) {
    res.status(502).json({ error: "Bad Gateway" });
  }
});

// ================= START =================
app.listen(4000, () => {
  console.log("🚀 Server running on http://localhost:4000");
  console.log("🤖 Agentic AI system ACTIVE");
});