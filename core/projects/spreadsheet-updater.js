require("dotenv").config();

const fs = require("fs-extra");
const path = require("path");
const XLSX = require("xlsx");
const { google, oauth2Client } = require("../integrations/google");
const { sanitizeName, PROGRESS_DIR, loadProjectStructure } = require("./drive-scanner");
const { loadProgress, updateItemProgress, getAllProgress } = require("./progress-manager");
const { getRABForDesa } = require("./rab-reader");

const TEMP_DIR = "/root/ai-system/workspace/temp";

function getDrive() {
  const token = JSON.parse(fs.readFileSync("/root/ai-system/tokens/google-token.json", "utf8"));
  oauth2Client.setCredentials(token);
  return google.drive({ version: "v3", auth: oauth2Client });
}

async function updateRABProgress(projectName, desaName, itemUraian, progressPercent) {
  // Update di memory dulu
  const updated = await updateItemProgress(projectName, desaName, itemUraian, progressPercent);
  console.log(`[UPDATER] Progress diupdate: ${desaName} - ${itemUraian}: ${progressPercent}%`);

  // Sinkronisasi ke spreadsheet
  await syncProgressToSheet(projectName, desaName, updated);

  return updated;
}

async function syncProgressToSheet(projectName, desaName, progress) {
  const rab = await getRABForDesa(projectName, desaName);
  if (!rab || !rab.items) return;

  const proj = await loadProjectStructure(projectName);
  if (!proj?.files?.rab?.id) return;

  const drive = getDrive();
  const rabFileId = proj.files.rab.id;
  const mimeType = proj.files.rab.mimeType;
  const destPath = path.join(TEMP_DIR, `rab_${sanitizeName(projectName)}_progress.xlsx`);

  await fs.ensureDir(TEMP_DIR);

  // Download RAB terbaru
  try {
    if (mimeType === "application/vnd.google-apps.spreadsheet") {
      const res = await drive.files.export(
        { fileId: rabFileId, mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
        { responseType: "arraybuffer" }
      );
      await fs.writeFile(destPath, Buffer.from(res.data));
    } else {
      const res = await drive.files.get(
        { fileId: rabFileId, alt: "media" },
        { responseType: "arraybuffer" }
      );
      await fs.writeFile(destPath, Buffer.from(res.data));
    }
  } catch (err) {
    console.error("[UPDATER] Gagal download RAB:", err.message);
    return;
  }

  const wb = XLSX.readFile(destPath);

  // Cari atau buat sheet PROGRESS
  let progressSheetName = wb.SheetNames.find(s => /progress/i.test(s));
  if (!progressSheetName) {
    progressSheetName = "PROGRESS";
    const blankWs = XLSX.utils.aoa_to_sheet([["Desa", "Item Pekerjaan", "Progress%", "Nilai Terealisasi", "Tgl Update", "Total Bobot Real"]]);
    XLSX.utils.book_append_sheet(wb, blankWs, progressSheetName);
  }

  // Build data progress untuk semua desa atau desa spesifik
  const header = ["Desa", "Item Pekerjaan", "Volume", "Satuan", "Bobot%", "Progress%", "Bobot Real", "Nilai Real", "Tgl Update"];
  const rows = [header];

  const { Fuse } = require("fuse.js") || {};
  for (const item of rab.items.filter(i => !i.is_kategori)) {
    const progressData = progress.items?.[item.uraian] || {};
    const pct = progressData.progress || 0;
    const bobotReal = parseFloat(((item.bobot || 0) * pct / 100).toFixed(4));
    const nilaiReal = Math.round((item.jumlah || 0) * pct / 100);
    rows.push([
      desaName, item.uraian, item.volume, item.satuan,
      (item.bobot || 0).toFixed(3), pct, bobotReal.toFixed(3), nilaiReal,
      progressData.updated_at ? progressData.updated_at.split("T")[0] : ""
    ]);
  }

  // Tambah baris total
  rows.push([
    desaName, "TOTAL PROGRESS", "", "",
    "100.000", progress.bobot_terealisasi || 0,
    (progress.bobot_terealisasi || 0).toFixed(3),
    progress.nilai_terealisasi || 0,
    new Date().toISOString().split("T")[0]
  ]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{wch:25},{wch:40},{wch:10},{wch:8},{wch:8},{wch:10},{wch:10},{wch:18},{wch:14}];
  wb.Sheets[progressSheetName] = ws;

  // Simpan dan upload
  const updatedPath = path.join(TEMP_DIR, `rab_${sanitizeName(projectName)}_updated.xlsx`);
  XLSX.writeFile(wb, updatedPath);

  // Upload sebagai file baru di folder desa (tidak overwrite RAB asli)
  try {
    const { findDesaFolder } = require("./drive-scanner");
    const desaInfo = await findDesaFolder(projectName, desaName);
    if (desaInfo) {
      const stream = fs.createReadStream(updatedPath);
      const today = new Date().toISOString().split("T")[0];
      await drive.files.create({
        resource: {
          name: `PROGRESS_${sanitizeName(desaName)}_${today}.xlsx`,
          parents: [desaInfo.drive_id]
        },
        media: {
          mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          body: stream
        },
        fields: "id,name"
      });
      console.log(`[UPDATER] Spreadsheet progress diupload ke Drive: ${desaName}`);
    }
  } catch (err) {
    console.error("[UPDATER] Upload spreadsheet gagal:", err.message);
  }
}

async function syncAllProgressToSheet(projectName) {
  const allProgress = await getAllProgress(projectName);
  let synced = 0;
  for (const p of allProgress) {
    try {
      await syncProgressToSheet(projectName, p.desa, p);
      synced++;
    } catch (err) {
      console.error(`[UPDATER] Skip ${p.desa}: ${err.message}`);
    }
  }
  return synced;
}

module.exports = {
  updateRABProgress,
  syncProgressToSheet,
  syncAllProgressToSheet
};
