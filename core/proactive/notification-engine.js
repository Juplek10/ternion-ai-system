require("dotenv").config();

const fs = require("fs-extra");
const path = require("path");

const WA_QUEUE_PATH = "/root/ai-system/workspace/wa-queue.json";
const BRIAN_NOMOR = "6282266130808";
const MEMORY_DIR = "/root/ai-system/memory";
const PROC_MEMINFO = "/proc/meminfo";

const sentToday = {};

// ─── Helper: queue ke WA ─────────────────────────────────
async function send(message) {
  console.log("[NOTIF]", message.substring(0, 80));
  try {
    await fs.ensureFile(WA_QUEUE_PATH);
    let queue = { items: [] };
    try { queue = await fs.readJson(WA_QUEUE_PATH); } catch {}
    if (!Array.isArray(queue.items)) queue.items = [];
    queue.items.push({
      id: Date.now(),
      nomor: BRIAN_NOMOR,
      pesan: message.replace(/<[^>]+>/g, ""),
      timestamp: new Date().toISOString(),
      status: "pending"
    });
    await fs.writeJson(WA_QUEUE_PATH, queue, { spaces: 2 });
  } catch (err) {
    console.error("[NOTIF] Gagal queue WA:", err.message);
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
function isFriday() {
  const d = new Date();
  return d.getUTCDay() === 5;
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
    ? data.projekList.map(p => `• ${(p.content || "").substring(0, 80)}`).join("\n")
    : "(belum ada)";

  const deadlineWarning = data.deadlineSoon.length > 0
    ? data.deadlineSoon.map(p => `⚠️ ${(p.content || "").substring(0, 80)}`).join("\n")
    : "(tidak ada)";

  const ramPct = getRAMPct();

  let calendarSection = "";
  try {
    const cal = require("../integrations/calendar");
    const todayEvents = await cal.getTodayEvents();
    if (todayEvents.length > 0) {
      const eventList = todayEvents.map(e => {
        const timeStr = e.start?.dateTime
          ? new Date(e.start.dateTime).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Makassar" })
          : "Sepanjang hari";
        return `🕐 ${timeStr} — ${e.summary}`;
      }).join("\n");
      calendarSection = `\n\n📅 Jadwal Hari Ini:\n${eventList}`;
    }
  } catch {}

  const msg =
`🌅 TERNION MORNING BRIEF
📅 ${dateStr}
━━━━━━━━━━━━━━━━━━━━━
🏗️ Proyek Aktif:
${proyekAktif}

⚠️ Deadline < 7 Hari:
${deadlineWarning}${calendarSection}

💻 Sistem: RAM ${ramPct}%
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

  try { proyek = await fs.readJson(path.join(MEMORY_DIR, "proyek.json")); } catch {}
  try { followups = await fs.readJson("/root/ai-system/memory/follow-ups/list.json"); } catch {}
  try { approvals = await fs.readJson("/root/ai-system/approvals/pending.json"); } catch {}
  try { delegasi = await fs.readJson("/root/ai-system/memory/delegasi-log.json"); } catch {}
  try { kontak = await fs.readJson("/root/ai-system/memory/contacts/registry.json"); } catch {}

  const now = new Date();
  const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

  const periodeAwal = weekAgo.toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
  const periodeAkhir = now.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });

  const proyekAktif = (proyek.entries || []).slice(-5)
    .map(p => `• ${(p.content || "").substring(0, 80)}`).join("\n") || "(belum ada)";

  const fuPending = (followups.followups || []).filter(f => f.status === "pending");
  const fuList = fuPending.length > 0
    ? fuPending.map(f => `• ${f.nama} — ${f.konteks.substring(0, 60)}`).join("\n")
    : "(tidak ada)";

  const aprPending = Object.values(approvals.pending || {}).filter(a => a.status === "pending");
  const aprList = aprPending.length > 0
    ? aprPending.map(a => `• ${a.nama} — ${a.konteks.substring(0, 60)}`).join("\n")
    : "(tidak ada)";

  const delegasiMingguIni = (delegasi.log || []).filter(d => new Date(d.waktu) >= weekAgo);
  const delegasiSummary = delegasiMingguIni.length > 0
    ? `${delegasiMingguIni.length} delegasi — ${[...new Set(delegasiMingguIni.map(d => d.topik_label))].join(", ")}`
    : "(tidak ada)";

  const ramPct = getRAMPct();

  const msg =
`📊 WEEKLY REPORT TERNION
━━━━━━━━━━━━━━━━━━━━━━━
📅 Periode: ${periodeAwal} – ${periodeAkhir}

🏗️ PROYEK AKTIF:
${proyekAktif}

👥 AKTIVITAS TIM:
${delegasiSummary}

📋 FOLLOW-UP PENDING (${fuPending.length}):
${fuList}

⚡ APPROVAL PENDING (${aprPending.length}):
${aprList}

💡 REKOMENDASI:
• Review follow-up sebelum akhir pekan
• Konfirmasi approval yang pending

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
      `💬 SUMMARY GRUP: ${grp.nama}\n` +
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
    await send(`⚠️ RAM TINGGI: ${pct}%\n\nSistem menggunakan ${pct}% RAM.\nPertimbangkan restart proses berat.\n⏰ ${new Date().toLocaleString("id-ID", { timeZone: "Asia/Makassar" })} WITA`);
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
      await send("📊 Weekly Project Report\n\nBelum ada proyek aktif.");
      return;
    }

    let lastSnapshot = {};
    try { lastSnapshot = await fs.readJson(WEEKLY_PROJ_SNAPSHOT); } catch {}

    const newSnapshot = {};
    const now = new Date();
    const periodeAkhir = now.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
    const periodeAwal = new Date(now - 7 * 24 * 60 * 60 * 1000)
      .toLocaleDateString("id-ID", { day: "2-digit", month: "short" });

    let reportParts = [
      `📊 LAPORAN MINGGUAN PROYEK`,
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

        const lastAvg = lastSnapshot[proj.nama]?.avg_progress || 0;
        const delta = (parseFloat(avgProgress) - parseFloat(lastAvg)).toFixed(1);
        const deltaStr = delta > 0 ? `▲ +${delta}%` : delta < 0 ? `▼ ${delta}%` : `→ 0%`;

        newSnapshot[proj.nama] = { avg_progress: avgProgress, total_nilai: totalNilaiReal };

        const sorted = [...allProgress].sort((a, b) => (b.bobot_terealisasi || 0) - (a.bobot_terealisasi || 0));
        const topDesa = sorted[0];
        const laggingDesa = sorted[sorted.length - 1];

        reportParts.push(`🏗️ ${proj.nama.toUpperCase()}`);
        reportParts.push(`   📈 Progress: ${avgProgress}% ${deltaStr}`);
        reportParts.push(`   💰 Nilai Real: Rp ${totalNilaiReal.toLocaleString("id-ID")}`);
        reportParts.push(`   📸 Foto: ${totalFoto} | Desa: ${allProgress.length}`);
        if (topDesa) reportParts.push(`   🥇 Terbaik: ${topDesa.desa} (${(topDesa.bobot_terealisasi || 0).toFixed(1)}%)`);
        if (laggingDesa && laggingDesa.desa !== topDesa?.desa)
          reportParts.push(`   ⚠️ Perhatian: ${laggingDesa.desa} (${(laggingDesa.bobot_terealisasi || 0).toFixed(1)}%)`);
        reportParts.push(`━━━━━━━━━━━━━━━━━━━━━━━`);
      } catch (err) {
        console.error(`[NOTIF] Skip proyek ${proj.nama}:`, err.message);
      }
    }

    reportParts.push(`🤖 TERNION-AI | ${now.toLocaleString("id-ID", { timeZone: "Asia/Makassar" })} WITA`);

    await send(reportParts.join("\n"));

    await fs.ensureDir(require("path").dirname(WEEKLY_PROJ_SNAPSHOT));
    await fs.writeJson(WEEKLY_PROJ_SNAPSHOT, newSnapshot, { spaces: 2 });

    console.log("[NOTIF] Weekly project report terkirim");
  } catch (err) {
    console.error("[NOTIF] Weekly project report error:", err.message);
    await send(`⚠️ Weekly project report gagal: ${err.message}`);
  }
}

// ─── Scheduler ───────────────────────────────────────────
async function tick() {
  const h = localHour();
  const m = localMinute();

  if (h === 6 && m < 5) await sendMorningBrief();
  if (h === 16 && m < 5 && isFriday()) await sendWeeklyProjectReport();
  if (h === 17 && m < 5 && isFriday()) await sendWeeklyReport();
  if (h === 21 && m < 5) await sendGroupSummary();

  await checkRAMAlert().catch(() => {});
}

console.log("[NOTIF-ENGINE] Berjalan — cek setiap menit");
setInterval(tick, 60 * 1000);
tick();

process.once("SIGINT", () => process.exit(0));
process.once("SIGTERM", () => process.exit(0));
