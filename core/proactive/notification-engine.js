require("dotenv").config();

const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || "8615852356:AAGzjiONLbkuSKBvXePPwhuKACkCZMC0QaY";
const CHAT_ID = 6935073123;
const MEMORY_DIR = "/root/ai-system/memory";
const PROC_MEMINFO = "/proc/meminfo";

const sentToday = {};

// ─── Helper: kirim Telegram ──────────────────────────────
async function send(message) {
  try {
    await axios.post(
      `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`,
      { chat_id: CHAT_ID, text: message, parse_mode: "HTML" },
      { timeout: 15000 }
    );
  } catch (err) {
    console.error("[NOTIF] Gagal kirim:", err.message);
  }
}

// ─── Helper: cek jam lokal WITA (UTC+8) ─────────────────
function localHour() {
  return (new Date().getUTCHours() + 8) % 24;
}
function localMinute() {
  return new Date().getUTCMinutes();
}
function todayKey() {
  return new Date().toISOString().split("T")[0];
}
function isMonday() {
  const d = new Date();
  return ((d.getUTCHours() + 8) >= 0) && d.getUTCDay() === 1;
}

// ─── Load data untuk brief ───────────────────────────────
async function loadBriefData() {
  let proyek = { entries: [] };
  let keputusan = { entries: [] };
  try { proyek = await fs.readJson(path.join(MEMORY_DIR, "proyek.json")); } catch {}
  try { keputusan = await fs.readJson(path.join(MEMORY_DIR, "keputusan.json")); } catch {}

  const now = Date.now();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  const deadlineSoon = (proyek.entries || []).filter(e => {
    if (!e.content) return false;
    const m = e.content.match(/\d{4}-\d{2}-\d{2}/);
    if (!m) return false;
    const dl = new Date(m[0]).getTime();
    return dl > now && dl - now < sevenDays;
  });

  return {
    projekList: (proyek.entries || []).slice(-5),
    deadlineSoon,
    recentDecisions: (keputusan.entries || []).slice(-3)
  };
}

// ─── RAM info ────────────────────────────────────────────
function getRAMPct() {
  try {
    const meminfo = require("fs").readFileSync(PROC_MEMINFO, "utf8");
    const total = parseInt(meminfo.match(/MemTotal:\s+(\d+)/)[1]);
    const avail = parseInt(meminfo.match(/MemAvailable:\s+(\d+)/)[1]);
    return Math.round(((total - avail) / total) * 100);
  } catch { return 0; }
}

// ─── Morning Brief (06.00 WITA) ─────────────────────────
async function sendMorningBrief() {
  const key = `morning_${todayKey()}`;
  if (sentToday[key]) return;
  sentToday[key] = true;

  const data = await loadBriefData();
  const dateStr = new Date().toLocaleDateString("id-ID", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
    timeZone: "Asia/Makassar"
  });

  const proyekAktif = data.projekList.length > 0
    ? data.projekList.map(p => `  • ${(p.content || "").substring(0, 80)}`).join("\n")
    : "  (belum ada)";

  const deadlineWarning = data.deadlineSoon.length > 0
    ? data.deadlineSoon.map(p => `  ⚠️ ${(p.content || "").substring(0, 80)}`).join("\n")
    : "  (tidak ada)";

  const ramPct = getRAMPct();

  const msg =
`🌅 <b>TERNION MORNING BRIEF</b>
📅 ${dateStr}
━━━━━━━━━━━━━━━━━━━━━
🏗️ <b>Proyek Aktif:</b>
${proyekAktif}

⚠️ <b>Deadline &lt; 7 Hari:</b>
${deadlineWarning}

💻 <b>Sistem:</b> RAM ${ramPct}%
━━━━━━━━━━━━━━━━━━━━━
💡 Selamat pagi, Bry! Semangat hari ini!`;

  await send(msg);
  console.log("[NOTIF] Morning brief terkirim");
}

// ─── Weekly Report (Senin 07.00 WITA) ───────────────────
async function sendWeeklyReport() {
  const key = `weekly_${todayKey()}`;
  if (sentToday[key]) return;
  sentToday[key] = true;

  let learnings = { learnings: [] };
  try {
    learnings = await fs.readJson(path.join(MEMORY_DIR, "long-term.json"));
  } catch {}

  const weeklyLearnings = (learnings.learnings || []).slice(-7)
    .map(l => `  • ${(l.content || l).substring(0, 100)}`).join("\n") || "  (belum ada)";

  const msg =
`📊 <b>WEEKLY REPORT TERNION</b>
━━━━━━━━━━━━━━━━━━━━━
📚 <b>Learnings minggu ini:</b>
${weeklyLearnings}

💪 Semangat minggu baru, Bry!
🎯 Fokus minggu ini dan tetap konsisten.`;

  await send(msg);
  console.log("[NOTIF] Weekly report terkirim");
}

// ─── Alert RAM tinggi ────────────────────────────────────
let ramAlertSent = null;
async function checkRAMAlert() {
  const pct = getRAMPct();
  const today = todayKey();
  if (pct > 80 && ramAlertSent !== today) {
    ramAlertSent = today;
    await send(`⚠️ <b>RAM TINGGI: ${pct}%</b>\n\nSistem menggunakan ${pct}% RAM.\nPertimbangkan untuk restart proses berat.\n⏰ ${new Date().toLocaleString("id-ID", { timeZone: "Asia/Makassar" })} WITA`);
  }
}

// ─── Scheduler ───────────────────────────────────────────
async function tick() {
  const h = localHour();
  const m = localMinute();

  // Morning brief: 06.00 WITA
  if (h === 6 && m < 5) await sendMorningBrief();

  // Weekly report: Senin 07.00 WITA
  if (h === 7 && m < 5 && isMonday()) await sendWeeklyReport();

  // RAM check setiap tick
  await checkRAMAlert().catch(() => {});
}

console.log("[NOTIF-ENGINE] Berjalan — cek setiap menit");
setInterval(tick, 60 * 1000);
tick(); // cek langsung saat start

process.once("SIGINT", () => process.exit(0));
process.once("SIGTERM", () => process.exit(0));
