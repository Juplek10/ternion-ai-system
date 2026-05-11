require("dotenv").config();

const http = require("http");
const { execFile } = require("child_process");
const { promisify } = require("util");
const fs = require("fs");

const execFileAsync = promisify(execFile);
const PORT = 3001;

async function getPM2Status() {
  try {
    const { stdout } = await execFileAsync("pm2", ["jlist"], { timeout: 10000 });
    const procs = JSON.parse(stdout);
    return procs.map(p => ({
      name: p.name,
      status: p.pm2_env.status,
      pid: p.pid,
      restarts: p.pm2_env.restart_time,
      uptime: p.pm2_env.pm_uptime
    }));
  } catch {
    return [];
  }
}

function getRAM() {
  try {
    const meminfo = fs.readFileSync("/proc/meminfo", "utf8");
    const total = parseInt(meminfo.match(/MemTotal:\s+(\d+)/)[1]) * 1024;
    const avail = parseInt(meminfo.match(/MemAvailable:\s+(\d+)/)[1]) * 1024;
    const used = total - avail;
    return {
      usedGB: (used / 1e9).toFixed(2),
      totalGB: (total / 1e9).toFixed(2),
      pct: Math.round((used / total) * 100)
    };
  } catch {
    return { usedGB: "?", totalGB: "?", pct: "?" };
  }
}

const server = http.createServer(async (req, res) => {
  if (req.url !== "/health" && req.url !== "/") {
    res.writeHead(404);
    res.end("Not Found");
    return;
  }

  const [procs, ram] = await Promise.all([getPM2Status(), Promise.resolve(getRAM())]);

  const allOnline = procs.every(p => p.status === "online");
  const status = {
    ok: allOnline,
    timestamp: new Date().toISOString(),
    ram,
    processes: procs,
    uptime: process.uptime()
  };

  res.writeHead(allOnline ? 200 : 503, { "Content-Type": "application/json" });
  res.end(JSON.stringify(status, null, 2));
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[HEALTH-CHECK] Running on http://127.0.0.1:${PORT}/health`);
});

process.once("SIGINT", () => server.close());
process.once("SIGTERM", () => server.close());
