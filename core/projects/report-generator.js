require("dotenv").config();

const fs = require("fs-extra");
const path = require("path");
const XLSX = require("xlsx");
const { sanitizeName, PROGRESS_DIR, loadProjectStructure, getAllProjects } = require("./drive-scanner");
const { getRABForDesa } = require("./rab-reader");
const { loadProgress, getAllProgress } = require("./progress-manager");
const { google, oauth2Client } = require("../integrations/google");

const TEMP_DIR = "/root/ai-system/workspace/temp";

function getDrive() {
  const token = JSON.parse(fs.readFileSync("/root/ai-system/tokens/google-token.json", "utf8"));
  oauth2Client.setCredentials(token);
  return google.drive({ version: "v3", auth: oauth2Client });
}

function rupiah(n) {
  return `Rp ${(n || 0).toLocaleString("id-ID")}`;
}

function progressBar(pct, width = 10) {
  const filled = Math.round((pct / 100) * width);
  return "█".repeat(filled) + "░".repeat(width - filled);
}

function statusFromProgress(pct) {
  if (pct >= 100) return "Selesai";
  if (pct >= 70) return "On Track";
  if (pct >= 30) return "Berjalan";
  if (pct > 0) return "Mulai";
  return "Belum";
}

async function generateDesaReport(projectName, desaName) {
  const rab = await getRABForDesa(projectName, desaName);
  const progress = await loadProgress(projectName, desaName);
  const today = new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });

  await fs.ensureDir(TEMP_DIR);
  const wb = XLSX.utils.book_new();

  // ── SHEET 1: RINGKASAN ─────────────────────────────────
  const summary = [
    ["LAPORAN PROGRESS PEKERJAAN — TERNION GROUP"],
    [],
    ["Proyek", projectName],
    ["Lokasi Desa", desaName],
    ["Tanggal", today],
    ["Sistem", "TERNION-AI Documentation System"],
    [],
    ["RINGKASAN PROGRESS", ""],
    ["Progress Keseluruhan", `${progress.bobot_terealisasi || 0}%`],
    ["Nilai Kontrak", rupiah(rab?.total_nilai || 0)],
    ["Nilai Terealisasi", rupiah(progress.nilai_terealisasi || 0)],
    ["Sisa Pekerjaan", rupiah((rab?.total_nilai || 0) - (progress.nilai_terealisasi || 0))],
    ["Total Foto Dokumentasi", progress.foto_log?.length || 0],
    ["Terakhir Diupdate", progress.last_update ? progress.last_update.split("T")[0] : "belum ada data"]
  ];

  const ws1 = XLSX.utils.aoa_to_sheet(summary);
  ws1["!cols"] = [{ wch: 30 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, ws1, "RINGKASAN");

  // ── SHEET 2: DETAIL RAB & PROGRESS ────────────────────
  const header2 = ["No", "Uraian Pekerjaan", "Volume", "Satuan", "Harga Satuan", "Jumlah", "Bobot%", "Progress%", "Bobot Real", "Nilai Real", "Status", "Tgl Update"];
  const rows2 = [header2];

  if (rab && rab.items) {
    for (const item of rab.items) {
      const progressData = progress.items?.[item.uraian] || {};
      const pct = progressData.progress || 0;
      const bobotReal = parseFloat(((item.bobot || 0) * pct / 100).toFixed(4));
      const nilaiReal = Math.round((item.jumlah || 0) * pct / 100);
      rows2.push([
        item.no, item.uraian, item.volume, item.satuan,
        item.harga_satuan || 0, item.jumlah || 0,
        (item.bobot || 0).toFixed(3),
        pct,
        bobotReal.toFixed(3),
        nilaiReal,
        statusFromProgress(pct),
        progressData.updated_at ? progressData.updated_at.split("T")[0] : ""
      ]);
    }
    rows2.push([
      "", "TOTAL", "", "", "", rab.total_nilai,
      "100.000", `${progress.bobot_terealisasi || 0}`,
      (progress.bobot_terealisasi || 0).toFixed(3),
      progress.nilai_terealisasi || 0, "", ""
    ]);
  }

  const ws2 = XLSX.utils.aoa_to_sheet(rows2);
  ws2["!cols"] = [
    {wch:6},{wch:40},{wch:10},{wch:8},{wch:15},{wch:18},
    {wch:8},{wch:10},{wch:10},{wch:18},{wch:10},{wch:12}
  ];
  XLSX.utils.book_append_sheet(wb, ws2, "RAB & PROGRESS");

  // ── SHEET 3: LOG DOKUMENTASI ───────────────────────────
  const header3 = ["Tanggal", "Pengirim", "Caption", "Analisa Singkat", "Progress Bobot", "Kondisi"];
  const rows3 = [header3];

  for (const log of (progress.foto_log || []).slice(-30)) {
    const analisa = log.analisa || {};
    rows3.push([
      log.tanggal ? log.tanggal.split("T")[0] : "",
      log.pengirim || "",
      log.caption || "",
      (analisa.pekerjaan_teridentifikasi || []).slice(0, 3).join(", "),
      `${analisa.bobot_terealisasi || 0}%`,
      analisa.kondisi_kualitas || ""
    ]);
  }

  if (rows3.length === 1) rows3.push(["Belum ada dokumentasi foto", "", "", "", "", ""]);

  const ws3 = XLSX.utils.aoa_to_sheet(rows3);
  ws3["!cols"] = [{wch:12},{wch:20},{wch:40},{wch:50},{wch:12},{wch:10}];
  XLSX.utils.book_append_sheet(wb, ws3, "LOG DOKUMENTASI");

  // ── SHEET 4: TIMELINE PROGRESS ────────────────────────
  const header4 = ["Tanggal", "Item Pekerjaan", "Progress Lama", "Progress Baru", "Perubahan", "Catatan"];
  const rows4 = [header4];

  for (const [uraian, data] of Object.entries(progress.items || {})) {
    rows4.push([
      data.updated_at ? data.updated_at.split("T")[0] : "",
      uraian,
      `${data.prev_progress || 0}%`,
      `${data.progress}%`,
      `+${(data.progress - (data.prev_progress || 0)).toFixed(1)}%`,
      ""
    ]);
  }

  if (rows4.length === 1) rows4.push(["Belum ada update progress", "", "", "", "", ""]);

  const ws4 = XLSX.utils.aoa_to_sheet(rows4);
  ws4["!cols"] = [{wch:12},{wch:40},{wch:14},{wch:12},{wch:12},{wch:30}];
  XLSX.utils.book_append_sheet(wb, ws4, "TIMELINE PROGRESS");

  // Simpan file
  const fileName = `LAPORAN_${sanitizeName(desaName)}_${today.replace(/ /g, "")}.xlsx`;
  const localPath = path.join(TEMP_DIR, fileName);
  XLSX.writeFile(wb, localPath);

  // Upload ke Drive (ke folder desa)
  let driveResult = null;
  try {
    const { findDesaFolder } = require("./drive-scanner");
    const desaInfo = await findDesaFolder(projectName, desaName);
    if (desaInfo) {
      const drive = getDrive();
      const stream = fs.createReadStream(localPath);
      const res = await drive.files.create({
        resource: { name: fileName, parents: [desaInfo.drive_id] },
        media: {
          mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          body: stream
        },
        fields: "id,name,webViewLink"
      });
      driveResult = res.data;
    }
  } catch (err) {
    console.error("[REPORT] Upload gagal:", err.message);
  }

  return {
    local_path: localPath,
    file_name: fileName,
    drive_id: driveResult?.id,
    drive_link: driveResult?.webViewLink,
    progress_pct: progress.bobot_terealisasi || 0,
    nilai_terealisasi: progress.nilai_terealisasi || 0,
    total_nilai: rab?.total_nilai || 0
  };
}

async function generateMasterReport(projectName) {
  const allProgress = await getAllProgress(projectName);
  const today = new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });
  const proj = await loadProjectStructure(projectName);

  await fs.ensureDir(TEMP_DIR);
  const wb = XLSX.utils.book_new();

  // ── SHEET REKAP SEMUA DESA ─────────────────────────────
  const header = ["Desa", "Kabupaten", "Progress%", "Bobot Real", "Nilai Terealisasi", "Total Foto", "Last Update", "Status"];
  const rows = [header];

  let totalNilaiReal = 0;
  let totalBobotReal = 0;
  let totalFoto = 0;

  for (const p of allProgress) {
    rows.push([
      p.desa,
      (proj?.kabupaten || []).find(k => k.desa?.find(d => d.nama === p.desa))?.nama || "",
      p.bobot_terealisasi || 0,
      (p.bobot_terealisasi || 0).toFixed(3),
      p.nilai_terealisasi || 0,
      p.foto_log?.length || 0,
      p.last_update ? p.last_update.split("T")[0] : "belum",
      statusFromProgress(p.bobot_terealisasi || 0)
    ]);
    totalNilaiReal += p.nilai_terealisasi || 0;
    totalBobotReal += p.bobot_terealisasi || 0;
    totalFoto += p.foto_log?.length || 0;
  }

  const avgProgress = allProgress.length > 0 ? (totalBobotReal / allProgress.length).toFixed(2) : 0;
  rows.push(["TOTAL / RATA-RATA", "", avgProgress, "", totalNilaiReal, totalFoto, today, ""]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{wch:25},{wch:25},{wch:12},{wch:12},{wch:20},{wch:10},{wch:14},{wch:12}];
  XLSX.utils.book_append_sheet(wb, ws, "REKAP SEMUA DESA");

  const fileName = `MASTER_REKAP_${sanitizeName(projectName)}_${today.replace(/ /g, "")}.xlsx`;
  const localPath = path.join(TEMP_DIR, fileName);
  XLSX.writeFile(wb, localPath);

  // Upload ke root proyek
  let driveResult = null;
  try {
    const drive = getDrive();
    const { id: projectDriveId } = require("./drive-scanner").KNOWN_ROOTS?.find?.(r => r.nama === projectName) ||
      (await require("./drive-scanner").loadProjectStructure(projectName)) || {};
    if (projectDriveId) {
      const stream = fs.createReadStream(localPath);
      const res = await drive.files.create({
        resource: { name: fileName, parents: [projectDriveId] },
        media: {
          mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          body: stream
        },
        fields: "id,name,webViewLink"
      });
      driveResult = res.data;
    }
  } catch (err) {
    console.error("[REPORT] Upload master gagal:", err.message);
  }

  return {
    local_path: localPath,
    file_name: fileName,
    drive_id: driveResult?.id,
    drive_link: driveResult?.webViewLink,
    total_desa: allProgress.length,
    avg_progress: avgProgress,
    total_nilai_real: totalNilaiReal,
    total_foto: totalFoto
  };
}

function buildProgressDashboard(projectName, allProgress) {
  if (!allProgress || allProgress.length === 0) {
    return `📊 <b>DASHBOARD ${projectName}</b>\n━━━━━━━━━━━━━━━━━━━\nBelum ada data progress.`;
  }

  const lines = allProgress.map(p => {
    const bar = progressBar(p.bobot_terealisasi || 0, 10);
    return `📍 <b>${p.desa}</b>: ${bar} ${(p.bobot_terealisasi || 0).toFixed(1)}%`;
  });

  const avgProgress = (allProgress.reduce((s, p) => s + (p.bobot_terealisasi || 0), 0) / allProgress.length).toFixed(1);
  const totalNilai = allProgress.reduce((s, p) => s + (p.nilai_terealisasi || 0), 0);

  return (
    `📊 <b>DASHBOARD ${projectName.toUpperCase()}</b>\n` +
    `━━━━━━━━━━━━━━━━━━━\n` +
    lines.join("\n") +
    `\n━━━━━━━━━━━━━━━━━━━\n` +
    `📈 Rata-rata: <b>${avgProgress}%</b> | ${rupiah(totalNilai)}`
  );
}

async function generateMBGReport(kecamatan, picNama, picHp, alamat, fotoCount = 0, progressItems = [], catatan = "", status = "Berjalan") {
  const today = new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });
  const timeStr = new Date().toLocaleString("id-ID", { timeZone: "Asia/Makassar", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

  let rabItems = "";
  if (progressItems.length > 0) {
    rabItems = "\n<b>📊 PROGRESS REHAB:</b>\n";
    progressItems.forEach((item, i) => {
      const bar = progressBar(item.pct || 0, 8);
      rabItems += `${i+1}. ${item.uraian}\n   ${bar} ${item.pct || 0}%\n`;
    });
  } else {
    rabItems = "\n📊 <i>Belum ada data progress RAB rehab.</i>";
  }

  const statusIcon = status === "Selesai" ? "✅" : status === "Terlambat" ? "⚠️" : "🔵";

  return (
    `📋 <b>LAPORAN PROGRESS DAPUR MBG</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🍳 Program: Makan Bergizi Gratis\n` +
    `📍 Kecamatan: <b>${kecamatan}</b>\n` +
    `👤 PIC: <b>${picNama}</b> | 📱 ${picHp || "-"}\n` +
    `🏠 Alamat: ${alamat}\n` +
    `🤝 Yayasan: Gaharu Global Mandiri\n` +
    `📅 Tanggal: ${today}\n` +
    rabItems +
    `\n📸 DOKUMENTASI: ${fotoCount} foto\n` +
    `🕐 Terakhir update: ${timeStr} WITA\n` +
    (catatan ? `\n⚠️ CATATAN: ${catatan}\n` : "") +
    `\n${statusIcon} STATUS: ${status}`
  );
}

module.exports = {
  generateDesaReport,
  generateMasterReport,
  buildProgressDashboard,
  generateMBGReport,
  progressBar
};
