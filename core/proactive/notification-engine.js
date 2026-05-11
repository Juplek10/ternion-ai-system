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

// ─── Weekly Consolidation Report (Jumat 17.00 WITA) ────
async function sendWeeklyReport() {
  const key = `weekly_${todayKey()}`;
  if (sentToday[key]) return;
  sentToday[key] = true;

  let proyek = { entries: [] };
  let followups = { followups: [] };
  let approvals = { pending: {} };
  let delegasi = { log: [] };
  let kontak = { contacts: {} };
  let hargaLog = [];

  try { proyek = await fs.readJson(path.join(MEMORY_DIR, "proyek.json")); } catch {}
  try { followups = await fs.readJson("/root/ai-system/memory/follow-ups/list.json"); } catch {}
  try { approvals = await fs.readJson("/root/ai-system/approvals/pending.json"); } catch {}
  try { delegasi = await fs.readJson("/root/ai-system/memory/delegasi-log.json"); } catch {}
  try { kontak = await fs.readJson("/root/ai-system/memory/contacts/registry.json"); } catch {}

  const now = new Date();
  const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

  // Tanggal periode
  const periodeAwal = weekAgo.toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
  const periodeAkhir = now.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });

  // Proyek aktif
  const proyekAktif = (proyek.entries || []).slice(-5)
    .map(p => `  • ${(p.content || "").substring(0, 80)}`).join("\n") || "  (belum ada)";

  // Follow-up pending
  const fuPending = (followups.followups || []).filter(f => f.status === "pending");
  const fuList = fuPending.length > 0
    ? fuPending.map(f => `  • ${f.nama} — ${f.konteks.substring(0, 60)} (deadline: ${f.deadline})`).join("\n")
    : "  (tidak ada)";

  // Approval pending
  const aprPending = Object.values(approvals.pending || {}).filter(a => a.status === "pending");
  const aprList = aprPending.length > 0
    ? aprPending.map(a => `  • ${a.nama} — ${a.konteks.substring(0, 60)}`).join("\n")
    : "  (tidak ada)";

  // Delegasi minggu ini
  const delegasiMingguIni = (delegasi.log || []).filter(d => new Date(d.waktu) >= weekAgo);
  const delegasiSummary = delegasiMingguIni.length > 0
    ? `  ${delegasiMingguIni.length} delegasi — ${[...new Set(delegasiMingguIni.map(d => d.topik_label))].join(", ")}`
    : "  (tidak ada)";

  // Kontak aktif
  const kontakAktif = Object.values(kontak.contacts || {})
    .filter(c => c.last_interaction && new Date(c.last_interaction) >= weekAgo && !c.nomor.includes("XXXXXXX"))
    .length;

  const ramPct = getRAMPct();

  const msg =
`📊 <b>WEEKLY REPORT TERNION</b>
━━━━━━━━━━━━━━━━━━━━━━━
📅 Periode: ${periodeAwal} – ${periodeAkhir}

🏗️ <b>PROYEK AKTIF:</b>
${proyekAktif}

👥 <b>AKTIVITAS TIM:</b>
  ${delegasiSummary}

🤝 <b>KONTAK AKTIF MINGGU INI:</b>
  ${kontakAktif} kontak berinteraksi

📋 <b>FOLLOW-UP PENDING (${fuPending.length}):</b>
${fuList}

⚡ <b>APPROVAL PENDING (${aprPending.length}):</b>
${aprList}

⚠️ <b>PERLU PERHATIAN:</b>
${fuPending.length > 3 ? "  • " + fuPending.length + " follow-up menumpuk — perlu tindak lanjut\n" : ""}${aprPending.length > 0 ? "  • " + aprPending.length + " approval belum diproses\n" : ""}${fuPending.length <= 3 && aprPending.length === 0 ? "  • Semua aman ✅\n" : ""}
💡 <b>REKOMENDASI AI:</b>
  • Review follow-up sebelum akhir pekan
  • Konfirmasi approval yang pending
  • Update status proyek aktif

💻 Sistem: RAM ${ramPct}%`;

  await send(msg);
  console.log("[NOTIF] Weekly Consolidation Report terkirim");
}

// ─── Group Summary (21.00 WITA setiap hari) ─────────────
async function sendGroupSummary() {
  const key = `grp_summary_${todayKey()}`;
  if (sentToday[key]) return;
  sentToday[key] = true;

  let grupRegistry = { groups: {} };
  try {
    grupRegistry = await fs.readJson("/root/ai-system/memory/contacts/grup-registry.json");
  } catch {}

  const groups = Object.values(grupRegistry.groups || {});
  if (groups.length === 0) return;

  for (const grp of groups) {
    const summaryMsg =
      `💬 <b>SUMMARY GRUP: ${grp.nama}</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `📊 Fungsi: ${grp.fungsi || "umum"}\n` +
      `📌 Status: aktif terpantau\n` +
      `⏰ ${new Date().toLocaleDateString("id-ID", { timeZone: "Asia/Makassar" })}`;
    await send(summaryMsg);
  }
  console.log("[NOTIF] Group summary terkirim");
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

// ─── Helper: cek Jumat ──────────────────────────────────
function isFriday() {
  const d = new Date();
  return d.getUTCDay() === 5;
}

// ─── Scheduler ───────────────────────────────────────────
async function tick() {
  const h = localHour();
  const m = localMinute();

  // Morning brief: 06.00 WITA
  if (h === 6 && m < 5) await sendMorningBrief();

  // Weekly Consolidation Report: Jumat 17.00 WITA
  if (h === 17 && m < 5 && isFriday()) await sendWeeklyReport();

  // Group Summary: 21.00 WITA setiap hari
  if (h === 21 && m < 5) await sendGroupSummary();

  // RAM check setiap tick
  await checkRAMAlert().catch(() => {});
}

console.log("[NOTIF-ENGINE] Berjalan — cek setiap menit");
setInterval(tick, 60 * 1000);
tick(); // cek langsung saat start

process.once("SIGINT", () => process.exit(0));
process.once("SIGTERM", () => process.exit(0));
