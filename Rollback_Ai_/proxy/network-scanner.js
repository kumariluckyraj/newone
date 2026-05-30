const { execFile } = require("child_process");
const net = require("net");

const PRIVATE_IPV4_RANGES = [
  /^10\./,
  /^127\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^169\.254\./,
];

const SCAN_PROFILES = {
  ping: ["-sn"],
  quick: ["-T3", "-F"],
  service: ["-sV", "--version-light", "-T3", "-F"],
  logwatch: ["-T3", "-p", "3000,4000,5001,5002"],
};

const NMAP_CANDIDATES = [
  process.env.NMAP_PATH,
  "nmap",
  "C:\\Program Files (x86)\\Nmap\\nmap.exe",
  "C:\\Program Files\\Nmap\\nmap.exe",
].filter(Boolean);

// ── existing helpers (unchanged) ──────────────────────────────────────────────

function normalizeTarget(target) { return String(target || "").trim(); }
function isPrivateIpv4(ip) { return PRIVATE_IPV4_RANGES.some((r) => r.test(ip)); }
function getBaseAddress(target) { return target.split("/")[0]; }

function isAllowedTarget(target) {
  if (!target || target.length > 253) return false;
  if (target === "localhost") return true;
  const baseAddress = getBaseAddress(target);
  const cidrMatch = target.match(/^(.+)\/(\d{1,2})$/);
  if (cidrMatch) {
    const prefix = Number(cidrMatch[2]);
    if (prefix < 24 || prefix > 32) return false;
  }
  if (net.isIP(baseAddress) === 4)
    return isPrivateIpv4(baseAddress) || process.env.NMAP_ALLOW_PUBLIC === "true";
  if (net.isIP(baseAddress) === 6)
    return baseAddress === "::1" || process.env.NMAP_ALLOW_PUBLIC === "true";
  return /^[a-zA-Z0-9.-]+$/.test(target) && process.env.NMAP_ALLOW_PUBLIC === "true";
}

function textFromXml(value) {
  return value
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

function readAttrs(tag) {
  const attrs = {};
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)="([^"]*)"/g;
  let m;
  while ((m = re.exec(tag)) !== null) attrs[m[1]] = textFromXml(m[2]);
  return attrs;
}

function parseNmapXml(xml) {
  const hosts = [];
  const hostRegex = /<host\b[\s\S]*?<\/host>/g;
  let hostMatch;
  while ((hostMatch = hostRegex.exec(xml)) !== null) {
    const hostXml = hostMatch[0];
    const statusTag  = hostXml.match(/<status\b[^>]*>/);
    const addressTag = hostXml.match(/<address\b[^>]*addr="[^"]+"[^>]*>/);
    const hostnameTag = hostXml.match(/<hostname\b[^>]*name="[^"]+"[^>]*>/);
    const host = {
      address:  addressTag  ? readAttrs(addressTag[0]).addr  : "unknown",
      hostname: hostnameTag ? readAttrs(hostnameTag[0]).name : "",
      status:   statusTag   ? readAttrs(statusTag[0]).state  : "unknown",
      ports: [],
    };
    const portRegex = /<port\b[^>]*>[\s\S]*?<\/port>/g;
    let portMatch;
    while ((portMatch = portRegex.exec(hostXml)) !== null) {
      const portXml = portMatch[0];
      const portTag    = portXml.match(/<port\b[^>]*>/);
      const stateTag   = portXml.match(/<state\b[^>]*>/);
      const serviceTag = portXml.match(/<service\b[^>]*>/);
      const pA = portTag    ? readAttrs(portTag[0])    : {};
      const sA = stateTag   ? readAttrs(stateTag[0])   : {};
      const svA = serviceTag ? readAttrs(serviceTag[0]) : {};
      host.ports.push({
        port: pA.portid || "", protocol: pA.protocol || "",
        state: sA.state || "unknown",
        service: svA.name || "", product: svA.product || "", version: svA.version || "",
      });
    }
    hosts.push(host);
  }
  return hosts;
}

function scanNetwork({ target, profile }) {
  const normalizedTarget = normalizeTarget(target);
  const selectedProfile  = SCAN_PROFILES[profile] ? profile : "quick";
  if (!isAllowedTarget(normalizedTarget)) {
    const err = new Error(
      "Target must be localhost or a private IPv4/CIDR range. Set NMAP_ALLOW_PUBLIC=true to permit public targets."
    );
    err.statusCode = 400;
    throw err;
  }
  const args = [...SCAN_PROFILES[selectedProfile], "-oX", "-", normalizedTarget];
  return new Promise((resolve, reject) => {
    const tryRun = (index) => {
      const command = NMAP_CANDIDATES[index];
      execFile(command, args, { timeout: 60000, maxBuffer: 1024 * 1024 * 4 }, (error, stdout, stderr) => {
        if (error?.code === "ENOENT" && index < NMAP_CANDIDATES.length - 1) {
          return tryRun(index + 1);
        }
        if (error) {
          const err = new Error(
            error.code === "ENOENT"
              ? "Nmap is not installed or not available in PATH."
              : stderr || error.message
          );
          err.statusCode = error.code === "ENOENT" ? 503 : 500;
          return reject(err);
        }
        resolve({
          target: normalizedTarget, profile: selectedProfile,
          scannedAt: new Date().toISOString(), hosts: parseNmapXml(stdout),
        });
      });
    };
    tryRun(0);
  });
}

// ── NEW: port reachability check (no nmap needed) ─────────────────────────────

const LOGWATCH_SERVICES = [
  { port: 3000, name: "React Dashboard" },
  { port: 4000, name: "Proxy / API Server" },
  { port: 5001, name: "Stable Backend" },
  { port: 5002, name: "Canary Backend" },
];

function checkPort(host, port, timeoutMs = 2000) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;
    const done = (open) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(open);
    };
    socket.setTimeout(timeoutMs);
    socket.on("connect", () => done(true));
    socket.on("timeout", () => done(false));
    socket.on("error",   () => done(false));
    socket.connect(port, host);
  });
}

async function diagnoseLogWatchNetwork(target = "127.0.0.1") {
  const host = target === "localhost" ? "127.0.0.1" : target;

  // Check each LogWatch port via TCP connect (instant, no nmap required)
  const serviceResults = await Promise.all(
    LOGWATCH_SERVICES.map(async ({ port, name }) => {
      const open = await checkPort(host, port);
      return {
        port,
        name,
        status: open ? "open" : "closed",
        explanation: open
          ? `${name} is reachable on port ${port}.`
          : `${name} is NOT reachable on port ${port}.`,
        fix: open
          ? null
          : `Start the ${name} process and make sure it is listening on port ${port}.`,
      };
    })
  );

  const networkIssues = serviceResults.filter((s) => s.status === "closed");

  // Also run a quick nmap scan so the UI scan table still populates
  let scan = null;
  try {
    scan = await scanNetwork({ target, profile: "logwatch" });
  } catch (_) {
    // nmap unavailable — TCP results are still returned above
  }

  return { services: serviceResults, networkIssues, scan };
}

// ── NEW: classify network-related errors from log entries ─────────────────────

const NETWORK_ERROR_PATTERNS = [
  {
    key: "ECONNREFUSED",
    title: "Connection Refused",
    severity: "HIGH",
    match: (log) =>
      /ECONNREFUSED|connection refused/i.test(JSON.stringify(log.responseBody || "")),
    explanation: "The backend actively refused the TCP connection. The target service is likely down.",
    fix: "Restart the target backend service and verify it is bound to the expected port.",
  },
  {
    key: "ETIMEDOUT",
    title: "Connection Timeout",
    severity: "HIGH",
    match: (log) =>
      /ETIMEDOUT|timed? ?out/i.test(JSON.stringify(log.responseBody || "")),
    explanation: "The connection attempt timed out — the host may be unreachable or overloaded.",
    fix: "Check network routing, firewall rules, and backend health.",
  },
  {
    key: "502",
    title: "Bad Gateway (502)",
    severity: "HIGH",
    match: (log) => Number(log.statusCode) === 502,
    explanation: "The proxy could not get a valid response from the upstream backend.",
    fix: "Ensure the target backend is running and healthy.",
  },
  {
    key: "503",
    title: "Service Unavailable (503)",
    severity: "HIGH",
    match: (log) => Number(log.statusCode) === 503,
    explanation: "The backend reported it is temporarily unavailable.",
    fix: "Check backend resource usage (CPU/memory) or restart the service.",
  },
  {
    key: "ENOTFOUND",
    title: "DNS / Host Not Found",
    severity: "MEDIUM",
    match: (log) =>
      /ENOTFOUND|getaddrinfo/i.test(JSON.stringify(log.responseBody || "")),
    explanation: "Hostname could not be resolved — possible DNS misconfiguration.",
    fix: "Verify the hostname in config.json and check DNS settings.",
  },
];

function classifyNetworkRelatedErrors(logs = []) {
  return NETWORK_ERROR_PATTERNS.reduce((findings, pattern) => {
    const matched = logs.filter(pattern.match);
    if (matched.length === 0) return findings;
    findings.push({
      key:         pattern.key,
      title:       pattern.title,
      severity:    pattern.severity,
      frequency:   matched.length,
      explanation: pattern.explanation,
      fix:         pattern.fix,
      examples:    matched.slice(0, 2).map((l) => ({
        statusCode: l.statusCode,
        message:    typeof l.responseBody === "string"
          ? l.responseBody.slice(0, 120)
          : JSON.stringify(l.responseBody || "").slice(0, 120),
      })),
    });
    return findings;
  }, []);
}

// ── exports ───────────────────────────────────────────────────────────────────

module.exports = { scanNetwork, diagnoseLogWatchNetwork, classifyNetworkRelatedErrors };