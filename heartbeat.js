require("dotenv").config();

const fs = require("fs-extra");
const axios = require("axios");
const { getSoul, loadSoul } = require("./core/identity/soul-guardian");

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || "8615852356:AAGzjiONLbkuSKBvXePPwhuKACkCZMC0QaY";
const CHAT_ID = 6935073123;
const HEARTBEAT_LOG = "/root/ai-system/memory/heartbeat-log.json";
const CHECK_INTERVAL = 5 * 60 * 1000;    // 5 menit
const REPORT_INTERVAL = 60 * 60 * 1000;  // 1 jam

let conversationCountToday = 0;
let lastReportHour = -1;

// ─── Kirim Telegram ────────────────────────────────────
async function sendTelegram(message) {
  try {
    await axios.post(
      `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`,
      { chat_id: CHAT_ID, text: message, parse_mode: "HTML" },
      { timeout: 15000 }
    );
  } catch (err) {
    console.error("[HEARTBEAT] Gagal kirim Telegram:", err.message);
  }
}

// ─── Cek RAM ────────────────────────────────────────────
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

// ─── Cek PM2 proses ─────────────────────────────────────
async function getPm2Status() {
  try {
    const res = await axios.get("http://localhost:9615", { timeout: 5000 }).catch(() => null);
    // PM2 API module tidak selalu aktif — pakai exec sebagai fallback
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

// ─── Cek Claude CLI ──────────────────────────────────────
async function checkOllama() {
  try {
    const { execSync } = require("child_process");
    execSync("claude --version", { timeout: 5000 });
    return { ok: true, model: "Claude ✅ (primary)" };
  } catch (err) {
    return { ok: false, model: "Claude CLI tidak ditemukan ❌" };
  }
}

// ─── Cek Drive ──────────────────────────────────────────
async function checkDrive() {
  try {
    const tokenPath = "/root/ai-system/tokens/google-token.json";
    if (!fs.existsSync(tokenPath)) return { ok: false };
    const { listFiles } = require("./core/integrations/drive");
    await listFiles();
    return { ok: true };
  } catch (err) {
    return { ok: false };
  }
}

// ─── Simpan log ──────────────────────────────────────────
async function saveLog(entry) {
  try {
    await fs.ensureFile(HEARTBEAT_LOG);
    let log = [];
    try { log = await fs.readJson(HEARTBEAT_LOG); } catch (e) {}
    if (!Array.isArray(log)) log = [];
    log.push(entry);
    if (log.length > 288) log = log.slice(-288); // 24 jam x 12 (per 5 menit)
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
  const pm2 = await getPm2Status();
  const ollama = await checkOllama();
  const soul = getSoul();
  const soulOk = soul && soul.length > 100;

  // Reload soul
  loadSoul();

  const entry = {
    time: now.toISOString(),
    ram: { pct: ram.pct, used: ram.usedGB, total: ram.totalGB },
    pm2: { online: pm2.online, total: pm2.total },
    ollama: ollama.ok,
    soul: soulOk
  };
  await saveLog(entry);

  console.log(`RAM: ${ram.usedGB}GB / ${ram.totalGB}GB (${ram.pct}%)`);
  console.log(`PM2: ${pm2.online}/${pm2.total} online`);
  console.log(`Claude: ${ollama.model}`);
  console.log(`Soul: ${soulOk ? "loaded" : "ERROR"}`);
  console.log("════════════════════════════════");

  // Alert darurat
  if (!ram.ok) {
    await sendTelegram(`⚠️ <b>ALERT RAM TINGGI</b>\nRAM usage: ${ram.pct}% (${ram.usedGB}GB / ${ram.totalGB}GB)\nSegera cek server!`);
  }
  if (pm2.crashed.length > 0) {
    await sendTelegram(`⚠️ <b>ALERT PROSES CRASH</b>\nProses mati: ${pm2.crashed.join(", ")}\nSegera restart!`);
  }
  if (!soulOk) {
    await sendTelegram(`⚠️ <b>ALERT SOUL FILE</b>\nSoul file hilang atau corrupt!\nSegera restore.`);
  }

  // Laporan per jam
  const hour = now.getHours();
  if (hour !== lastReportHour) {
    lastReportHour = hour;
    await sendHourlyReport(ram, pm2, ollama, soulOk, timeStr);
  }
}

// ─── Laporan 1 jam sekali ────────────────────────────────
async function sendHourlyReport(ram, pm2, ollama, soulOk, timeStr) {
  const driveStatus = await checkDrive();
  const ramIcon = ram.ok ? "✅" : "🔴";
  const pm2Icon = pm2.crashed.length === 0 ? "✅" : "❌";
  const driveIcon = driveStatus.ok ? "✅" : "❌";
  const soulIcon = soulOk ? "✅" : "❌";

  const msg =
`🫀 <b>TERNION-AI HEARTBEAT</b>
─────────────────────
⏰ ${timeStr}
🤖 AI: ${ollama.model}
💾 RAM: ${ram.usedGB} GB / ${ram.totalGB} GB (${ram.pct}%) ${ramIcon}
⚡ Proses: ${pm2.online}/${pm2.total} online ${pm2Icon}
📁 Drive: ${driveStatus.ok ? "terhubung ✅" : "tidak terhubung ❌"}
💬 Percakapan hari ini: ${conversationCountToday}
🔋 Soul: ${soulIcon}`;

  await sendTelegram(msg);
}

// Jalankan pertama kali langsung
runHeartbeat();

// Loop setiap 5 menit
setInterval(runHeartbeat, CHECK_INTERVAL);

// Export untuk modul lain
module.exports = { incrementConversation: () => conversationCountToday++ };
