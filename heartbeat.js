require("dotenv").config();

const fs = require("fs-extra");
const { getSoul, loadSoul } = require("./core/identity/soul-guardian");

process.on("uncaughtException", (err) => {
  console.error("[HEARTBEAT] uncaughtException:", err.message);
});
process.on("unhandledRejection", (reason) => {
  console.error("[HEARTBEAT] unhandledRejection:", reason instanceof Error ? reason.message : String(reason));
});

const HEARTBEAT_LOG = "/root/ai-system/memory/heartbeat-log.json";
const WA_QUEUE_PATH = "/root/ai-system/workspace/wa-queue.json";
const BRIAN_NOMOR = "6282266130808";
const CHECK_INTERVAL = 5 * 60 * 1000;
const REPORT_INTERVAL = 60 * 60 * 1000;

let conversationCountToday = 0;
let lastReportHour = -1;

// ─── Kirim notifikasi via WA queue ──────────────────────
async function sendNotify(message) {
  try {
    await fs.ensureFile(WA_QUEUE_PATH);
    let queue = { items: [] };
    try { queue = await fs.readJson(WA_QUEUE_PATH); } catch {}
    if (!Array.isArray(queue.items)) queue.items = [];
    queue.items.push({
      id: Date.now(),
      nomor: BRIAN_NOMOR,
      pesan: message,
      timestamp: new Date().toISOString(),
      status: "pending"
    });
    await fs.writeJson(WA_QUEUE_PATH, queue, { spaces: 2 });
    console.log("[HEARTBEAT] Notifikasi antri ke WA");
  } catch (err) {
    console.error("[HEARTBEAT] Gagal queue WA:", err.message);
  }
}

// ─── Cek RAM ─────────────────────────────────────────────
function getRamInfo() {
  try {
    const meminfo = fs.readFileSync("/proc/meminfo", "utf8");
    const total = parseInt(meminfo.match(/MemTotal:\s+(\d+)/)[1]) * 1024;
    const avail = parseInt(meminfo.match(/MemAvailable:\s+(\d+)/)[1]) * 1024;
    const used = total - avail;
    const pct = Math.round((used / total) * 100);
    const usedGB = (used / 1e9).toFixed(1);
    const totalGB = (total / 1e9).toFixed(1);
    return { pct, usedGB, totalGB, ok: pct < 85 };
  } catch (err) {
    return { pct: 0, usedGB: "?", totalGB: "?", ok: true };
  }
}

// ─── Cek Disk ────────────────────────────────────────────
function getDiskInfo() {
  try {
    const { execSync } = require("child_process");
    const out = execSync("df -h / | tail -1", { encoding: "utf8" });
    const parts = out.trim().split(/\s+/);
    return { used: parts[2], avail: parts[3], pct: parts[4] };
  } catch {
    return { used: "?", avail: "?", pct: "?" };
  }
}

// ─── Cek PM2 proses ──────────────────────────────────────
async function getPm2Status() {
  try {
    const { execSync } = require("child_process");
    const out = execSync("pm2 jlist 2>/dev/null", { timeout: 5000 }).toString();
    const procs = JSON.parse(out);
    const online = procs.filter(p => p.pm2_env.status === "online").length;
    const total = procs.length;
    const crashed = procs.filter(p => p.pm2_env.status !== "online").map(p => p.name);
    return { online, total, crashed, ok: crashed.length === 0 };
  } catch (err) {
    return { online: "?", total: "?", crashed: [], ok: true };
  }
}

// ─── Cek Claude CLI ───────────────────────────────────────
async function checkClaude() {
  try {
    const { execSync } = require("child_process");
    execSync("claude --version", { timeout: 5000 });
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

// ─── Cek WA Connected ────────────────────────────────────
function checkWAConnected() {
  try {
    const statePath = "/root/ai-system/.wwebjs_auth";
    return fs.existsSync(statePath);
  } catch {
    return false;
  }
}

// ─── Simpan log ───────────────────────────────────────────
async function saveLog(entry) {
  try {
    await fs.ensureFile(HEARTBEAT_LOG);
    let log = [];
    try { log = await fs.readJson(HEARTBEAT_LOG); } catch {}
    if (!Array.isArray(log)) log = [];
    log.push(entry);
    if (log.length > 288) log = log.slice(-288);
    await fs.writeJson(HEARTBEAT_LOG, log, { spaces: 2 });
  } catch (err) {
    console.error("[HEARTBEAT] Gagal simpan log:", err.message);
  }
}

// ─── HEARTBEAT UTAMA (setiap 5 menit) ───────────────────
async function runHeartbeat() {
  const now = new Date();
  const timeStr = now.toLocaleString("id-ID", { timeZone: "Asia/Makassar" });

  console.log("════════════════════════════════");
  console.log("TERNION-AI HEARTBEAT |", timeStr);

  const ram = getRamInfo();
  const disk = getDiskInfo();
  const pm2 = await getPm2Status();
  const claude = await checkClaude();
  const waOk = checkWAConnected();
  const soul = getSoul();
  const soulOk = soul && soul.length > 100;

  loadSoul();

  const entry = {
    time: now.toISOString(),
    ram: { pct: ram.pct, used: ram.usedGB, total: ram.totalGB },
    disk,
    pm2: { online: pm2.online, total: pm2.total },
    claude: claude.ok,
    wa: waOk,
    soul: soulOk
  };
  await saveLog(entry);

  console.log(`RAM: ${ram.usedGB}GB / ${ram.totalGB}GB (${ram.pct}%)`);
  console.log(`Disk: ${disk.used} dipakai, ${disk.avail} tersedia (${disk.pct})`);
  console.log(`PM2: ${pm2.online}/${pm2.total} online`);
  console.log(`Claude: ${claude.ok ? "aktif" : "standby"}`);
  console.log(`WA: ${waOk ? "terhubung" : "terputus"}`);
  console.log("════════════════════════════════");

  // Alert darurat
  if (!ram.ok) {
    await sendNotify(`⚠️ ALERT RAM TINGGI\nRAM: ${ram.pct}% (${ram.usedGB}GB / ${ram.totalGB}GB)\nSegera cek server!`);
  }
  if (pm2.crashed.length > 0) {
    await sendNotify(`⚠️ ALERT PROSES CRASH\nMati: ${pm2.crashed.join(", ")}\nSegera restart!`);
  }

  // Laporan per jam — pakai WITA (UTC+8)
  const hour = (now.getUTCHours() + 8) % 24;
  if (hour !== lastReportHour) {
    lastReportHour = hour;
    await sendHourlyReport(ram, disk, pm2, claude, waOk, soulOk, timeStr);
  }
}

// ─── Laporan 1 jam sekali via WA ─────────────────────────
async function sendHourlyReport(ram, disk, pm2, claude, waOk, soulOk, timeStr) {
  const pm2OnlineCount = typeof pm2.online === "number" ? pm2.online : "?";
  const pm2CrashedCount = pm2.crashed.length;

  const msg =
`🤖 TERNION HEARTBEAT
⏰ ${timeStr} WITA
━━━━━━━━━━━━━━━
PM2: ✅${pm2OnlineCount} online${pm2CrashedCount > 0 ? " ❌" + pm2CrashedCount + " error" : ""}
Claude: ${claude.ok ? "✅" : "⚠️"} | WA: ${waOk ? "✅" : "❌"}
RAM: ${ram.usedGB}GB/${ram.totalGB}GB (${ram.pct}%)
Disk: ${disk.used} dipakai | ${disk.avail} bebas
━━━━━━━━━━━━━━━
Status: ${pm2CrashedCount === 0 && ram.ok ? "🟢 NORMAL" : "🔴 PERHATIAN"}`;

  await sendNotify(msg);
}

runHeartbeat();
setInterval(runHeartbeat, CHECK_INTERVAL);

module.exports = { incrementConversation: () => conversationCountToday++ };
