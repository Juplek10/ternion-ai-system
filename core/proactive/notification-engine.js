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

  // Coba ambil jadwal Google Calendar hari ini
  let calendarSection = "";
  try {
    const cal = require("../integrations/calendar");
    const todayEvents = await cal.getTodayEvents();
    if (todayEvents.length > 0) {
      const eventList = todayEvents.map(e => {
        const timeStr = e.start?.dateTime
          ? new Date(e.start.dateTime).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Makassar" })
          : "Sepanjang hari";
        return `  🕐 ${timeStr} — ${e.summary}`;
      }).join("\n");
      calendarSection = `\n\n📅 <b>Jadwal Hari Ini:</b>\n${eventList}`;
    }
  } catch {}

  const msg =
`🌅 <b>TERNION MORNING BRIEF</b>
📅 ${dateStr}
━━━━━━━━━━━━━━━━━━━━━
🏗️ <b>Proyek Aktif:</b>
${proyekAktif}

⚠️ <b>Deadline &lt; 7 Hari:</b>
${deadlineWarning}${calendarSection}

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

// ─── Weekly Project Report (Jumat 16.00 WITA) ──────────
const WEEKLY_PROJ_SNAPSHOT = "/root/ai-system/memory/projects/weekly-snapshot.json";

async function sendWeeklyProjectReport() {
  const key = `weekly_proj_${todayKey()}`;
  if (sentToday[key]) return;
  sentToday[key] = true;

  try {
    const { getAllProjects } = require("../projects/drive-scanner");
    const { getAllProgress } = require("../projects/progress-manager");
    const { generateMasterReport } = require("../projects/report-generator");

    const projects = await getAllProjects();
    if (!projects || projects.length === 0) {
      await send("📊 <b>Weekly Project Report</b>\n\nBelum ada proyek aktif yang terdeteksi.");
      return;
    }

    // Load snapshot minggu lalu
    let lastSnapshot = {};
    try {
      lastSnapshot = await fs.readJson(WEEKLY_PROJ_SNAPSHOT);
    } catch {}

    const newSnapshot = {};
    const now = new Date();
    const periodeAkhir = now.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
    const periodeAwal = new Date(now - 7 * 24 * 60 * 60 * 1000)
      .toLocaleDateString("id-ID", { day: "2-digit", month: "short" });

    let reportParts = [
      `📊 <b>LAPORAN MINGGUAN PROYEK</b>`,
      `━━━━━━━━━━━━━━━━━━━━━━━`,
      `📅 Periode: ${periodeAwal} – ${periodeAkhir}`,
      ``
    ];

    for (const proj of projects) {
      try {
        const allProgress = await getAllProgress(proj.nama);
        if (!allProgress || allProgress.length === 0) continue;

        const totalBobotReal = allProgress.reduce((s, p) => s + (p.bobot_terealisasi || 0), 0);
        const avgProgress = (totalBobotReal / allProgress.length).toFixed(1);
        const totalNilaiReal = allProgress.reduce((s, p) => s + (p.nilai_terealisasi || 0), 0);
        const totalFoto = allProgress.reduce((s, p) => s + (p.foto_log?.length || 0), 0);

        // Perbandingan dengan snapshot minggu lalu
        const lastAvg = lastSnapshot[proj.nama]?.avg_progress || 0;
        const delta = (parseFloat(avgProgress) - parseFloat(lastAvg)).toFixed(1);
        const deltaStr = delta > 0 ? `▲ +${delta}%` : delta < 0 ? `▼ ${delta}%` : `→ 0%`;

        newSnapshot[proj.nama] = { avg_progress: avgProgress, total_nilai: totalNilaiReal };

        // Top performer dan yang perlu perhatian
        const sorted = [...allProgress].sort((a, b) => (b.bobot_terealisasi || 0) - (a.bobot_terealisasi || 0));
        const topDesa = sorted[0];
        const laggingDesa = sorted[sorted.length - 1];

        reportParts.push(`🏗️ <b>${proj.nama.toUpperCase()}</b>`);
        reportParts.push(`   📈 Progress: <b>${avgProgress}%</b> ${deltaStr}`);
        reportParts.push(`   💰 Nilai Real: Rp ${totalNilaiReal.toLocaleString("id-ID")}`);
        reportParts.push(`   📸 Foto masuk: ${totalFoto} | Desa: ${allProgress.length}`);
        if (topDesa) reportParts.push(`   🥇 Terbaik: ${topDesa.desa} (${(topDesa.bobot_terealisasi || 0).toFixed(1)}%)`);
        if (laggingDesa && laggingDesa.desa !== topDesa?.desa)
          reportParts.push(`   ⚠️ Perlu perhatian: ${laggingDesa.desa} (${(laggingDesa.bobot_terealisasi || 0).toFixed(1)}%)`);
        reportParts.push(``);

        // Generate master report Excel dan upload Drive
        try {
          const result = await generateMasterReport(proj.nama);
          if (result?.drive_link) {
            reportParts.push(`   📁 <a href="${result.drive_link}">Unduh Laporan Excel</a>`);
          }
        } catch (err) {
          console.error(`[NOTIF] Master report ${proj.nama} gagal:`, err.message);
        }

        reportParts.push(`━━━━━━━━━━━━━━━━━━━━━━━`);
      } catch (err) {
        console.error(`[NOTIF] Skip proyek ${proj.nama}:`, err.message);
      }
    }

    reportParts.push(`🤖 TERNION-AI | ${now.toLocaleString("id-ID", { timeZone: "Asia/Makassar" })} WITA`);

    await send(reportParts.join("\n"));

    // Simpan snapshot baru
    await fs.ensureDir(require("path").dirname(WEEKLY_PROJ_SNAPSHOT));
    await fs.writeJson(WEEKLY_PROJ_SNAPSHOT, newSnapshot, { spaces: 2 });

    console.log("[NOTIF] Weekly project report terkirim");
  } catch (err) {
    console.error("[NOTIF] Weekly project report error:", err.message);
    await send(`⚠️ Weekly project report gagal: ${err.message}`);
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

  // Weekly Project Report: Jumat 16.00 WITA
  if (h === 16 && m < 5 && isFriday()) await sendWeeklyProjectReport();

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
