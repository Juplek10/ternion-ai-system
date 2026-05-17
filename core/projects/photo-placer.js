require("dotenv").config();

const fs = require("fs-extra");
const path = require("path");
const axios = require("axios");
const { google, oauth2Client } = require("../integrations/google");
const { getAllDesa, getAllProjects, findDesaFolder } = require("./drive-scanner");

const UNPLACED_DIR = "/root/ai-system/workspace/uploads/unplaced";
const PLACED_LOG = "/root/ai-system/memory/projects/placed-photos.json";

// Pending foto state (untuk konfirmasi Brian)
const pendingPhotos = new Map();

function getDrive() {
  const token = JSON.parse(fs.readFileSync("/root/ai-system/tokens/google-token.json", "utf8"));
  oauth2Client.setCredentials(token);
  return google.drive({ version: "v3", auth: oauth2Client });
}

async function detectDesaFromCaption(caption, projectName) {
  if (!caption) return null;
  const Fuse = require("fuse.js");
  const desas = await getAllDesa(projectName);
  if (desas.length === 0) return null;

  const fuse = new Fuse(desas, { keys: ["nama"], threshold: 0.4, includeScore: true });

  // Coba match caption penuh dulu
  let results = fuse.search(caption);
  let best = results[0];
  let confidence = best ? Math.round((1 - best.score) * 100) : 0;
  if (confidence >= 60) return { ...best.item, confidence };

  // Tokenize caption dan coba setiap kata/pasangan kata
  const words = caption.toLowerCase().replace(/[^a-z\s]/gi, " ").split(/\s+/).filter(w => w.length >= 4);
  for (let i = 0; i < words.length; i++) {
    for (const term of [words[i], i + 1 < words.length ? words[i] + " " + words[i + 1] : null].filter(Boolean)) {
      const res = fuse.search(term);
      if (res.length > 0) {
        const c = Math.round((1 - res[0].score) * 100);
        if (c > confidence) { confidence = c; best = res[0]; }
      }
    }
  }
  return confidence >= 60 ? { ...best.item, confidence } : null;
}

// Keyword mapping untuk DAPUR MANDIRI MBG per kecamatan
const DAPUR_MANDIRI_KEYWORD_MAP = {
  alak: {
    folder_id: "1YYcFTF_Er1kPVu9RorIZdUvvveXLWl_j",
    kecamatan: "ALAK",
    keywords: ["alak", "penkase", "penkase oeleta", "imanuel", "atiballe", "sri dariasih", "kasman", "alak 2", "alak 1"]
  },
  kelapa_lima: {
    folder_id: "1ak_GUtpPnTtsoOVbjUDHli4kIWPWu1dc",
    kecamatan: "KELAPA LIMA",
    keywords: ["kelapa lima", "oesapa", "oesapa barat", "jhon caine", "pello", "kelapa lima 1"]
  },
  kota_raja: {
    folder_id: "1GHrtulHgYSFMQtoMDry22fnT-3l4j1Ft",
    kecamatan: "KOTA RAJA",
    keywords: ["kota raja", "naikoten", "batuplat", "bintang", "paschariella", "sodai", "hilda", "azmi", "karima", "kota raja 4", "kota raja 5", "kota raja 6"]
  },
  kota_oebobo: {
    folder_id: "171opWYPfX9xXjz0qKpxilbK5LVpah5Oy",
    kecamatan: "KOTA OEBOBO",
    keywords: ["oebobo", "oetete", "laurensia", "yuwono", "oebobo 5"]
  }
};

// Keyword mapping untuk DAPUR 3T
const DAPUR_3T_KEYWORDS = ["dapur 3t", "3t", "dapur tiga t", "tiga t"];

function detectDapurMandiriKecamatan(caption) {
  if (!caption) return null;
  const lower = caption.toLowerCase();
  for (const [key, data] of Object.entries(DAPUR_MANDIRI_KEYWORD_MAP)) {
    if (data.keywords.some(kw => lower.includes(kw))) {
      return { kecamatan: data.kecamatan, folder_id: data.folder_id, key };
    }
  }
  return null;
}

async function detectProjectFromCaption(caption) {
  if (!caption) return null;
  const lower = caption.toLowerCase();

  // Cek DAPUR MANDIRI keywords dulu (lebih spesifik)
  const dapurMandiriMatch = detectDapurMandiriKecamatan(caption);
  if (dapurMandiriMatch) return { nama: "DAPUR MANDIRI - MBG", kecamatan: dapurMandiriMatch };

  // Cek DAPUR 3T keywords
  if (DAPUR_3T_KEYWORDS.some(kw => lower.includes(kw))) return { nama: "DAPUR 3T" };

  const projects = await getAllProjects();
  if (projects.length === 0) return null;

  const Fuse = require("fuse.js");
  const fuse = new Fuse(projects, { keys: ["nama"], threshold: 0.4, includeScore: true });
  const results = fuse.search(caption);
  if (results.length > 0 && results[0].score < 0.5) return results[0].item;

  // Default ke proyek pertama jika hanya ada satu
  return projects.length === 1 ? projects[0] : null;
}

function cleanCaption(caption) {
  return (caption || "").replace(/[^a-zA-Z0-9\-_]/g, "-").substring(0, 40).replace(/-+/g, "-");
}

function buildDriveFileName(pengirim, caption) {
  const tanggal = new Date().toISOString().split("T")[0].replace(/-/g, "");
  const pengirimClean = (pengirim || "unknown").replace(/[^a-zA-Z0-9]/g, "").substring(0, 15);
  const captionClean = cleanCaption(caption);
  return `${tanggal}_${pengirimClean}_${captionClean}.jpg`;
}

async function uploadPhotoToDrive(localPath, desaFolderId, fileName) {
  const drive = getDrive();
  const fileStream = fs.createReadStream(localPath);

  const response = await drive.files.create({
    resource: { name: fileName, parents: [desaFolderId] },
    media: { mimeType: "image/jpeg", body: fileStream },
    fields: "id,name,webViewLink"
  });

  return response.data;
}

async function placePhotoToDrive(localPath, projectName, desaNama, desaDriveId, pengirim, caption) {
  const fileName = buildDriveFileName(pengirim, caption);
  const uploaded = await uploadPhotoToDrive(localPath, desaDriveId, fileName);

  // Log penempatan
  const logEntry = {
    tanggal: new Date().toISOString(),
    project: projectName,
    desa: desaNama,
    pengirim,
    caption,
    local_path: localPath,
    drive_id: uploaded.id,
    drive_link: uploaded.webViewLink,
    file_name: fileName
  };

  const logData = await fs.readJson(PLACED_LOG).catch(() => ({ entries: [] }));
  logData.entries.unshift(logEntry);
  logData.entries = logData.entries.slice(0, 500);
  await fs.ensureDir(path.dirname(PLACED_LOG));
  await fs.writeJson(PLACED_LOG, logData, { spaces: 2 });

  return { drive_id: uploaded.id, drive_link: uploaded.webViewLink, file_name: fileName };
}

async function notifyTelegram(text, keyboard = null) {
  const payload = {
    chat_id: BRIAN_CHAT_ID,
    text,
    parse_mode: "HTML"
  };
  if (keyboard) payload.reply_markup = { inline_keyboard: keyboard };

  try {
    console.log('[NOTIFY]', message);
  } catch (err) {
    console.error("[PHOTO-PLACER] Telegram notif gagal:", err.message);
  }
}

async function handleIncomingPhoto(localPath, caption, pengirim, platform = "whatsapp") {
  await fs.ensureDir(UNPLACED_DIR);

  // Deteksi proyek
  const projects = await getAllProjects();
  let projectName = projects[0]?.nama || "DAPUR 3T";

  // Coba detect proyek dari caption
  const detectedProject = await detectProjectFromCaption(caption);
  if (detectedProject) projectName = detectedProject.nama;

  // Jika DAPUR MANDIRI terdeteksi dengan kecamatan → auto-place ke folder kecamatan
  if (detectedProject?.kecamatan) {
    const kec = detectedProject.kecamatan;
    try {
      const placed = await placePhotoToDrive(
        localPath, projectName, kec.kecamatan, kec.folder_id, pengirim, caption
      );
      const timeStr = new Date().toLocaleString("id-ID", { timeZone: "Asia/Makassar", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
      await notifyTelegram(
        `📸 <b>FOTO DAPUR MANDIRI MASUK</b>\n━━━━━━━━━━━━━━━━━━━━\n` +
        `👤 Dari: ${pengirim}\n📍 <b>${kec.kecamatan}</b>\n💬 ${caption || "(tidak ada)"}\n⏰ ${timeStr} WITA\n✅ Tersimpan ke Drive`,
        [[{ text: "📁 Lihat Drive", url: placed.drive_link }, { text: "📋 Laporan", callback_data: "dm:lap:" + kec.key }]]
      );
      return { placed: true, desa: kec.kecamatan, project: projectName, drive_link: placed.drive_link };
    } catch (err) {
      console.error("[PHOTO-PLACER] MANDIRI upload gagal:", err.message);
    }
  }

  // Coba deteksi desa dari caption
  const detectedDesa = await detectDesaFromCaption(caption, projectName);

  const timeStr = new Date().toLocaleString("id-ID", {
    timeZone: "Asia/Makassar",
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit"
  });

  if (detectedDesa && detectedDesa.confidence >= 70) {
    // Auto-place
    try {
      const placed = await placePhotoToDrive(
        localPath, projectName, detectedDesa.nama, detectedDesa.drive_id, pengirim, caption
      );

      const photoId = `ph_${Date.now()}`;
      pendingPhotos.set(photoId, {
        localPath, projectName, desaNama: detectedDesa.nama,
        desaDriveId: detectedDesa.drive_id, pengirim, caption,
        driveLink: placed.drive_link, placed: true
      });

      await notifyTelegram(
        `📸 <b>FOTO PROGRESS MASUK</b>\n━━━━━━━━━━━━━━━━━━━━\n` +
        `👤 Dari: ${pengirim}\n` +
        `📍 <b>${detectedDesa.nama}</b> → ${detectedDesa.kab}\n` +
        `📁 ${projectName}\n` +
        `💬 Caption: ${caption || "(tidak ada)"}\n` +
        `⏰ ${timeStr} WITA\n` +
        `✅ Sudah disimpan ke Drive`,
        [
          [
            { text: "🔍 Analisa Sekarang", callback_data: `pa:ana:${photoId}` },
            { text: "📁 Lihat Drive", url: placed.drive_link }
          ],
          [{ text: "⏭️ Skip", callback_data: `pa:skip:${photoId}` }]
        ]
      );

      return { placed: true, desa: detectedDesa.nama, project: projectName, drive_link: placed.drive_link };
    } catch (err) {
      console.error("[PHOTO-PLACER] Upload gagal:", err.message);
    }
  }

  // Tidak bisa auto-detect → simpan sementara dan minta konfirmasi
  const tempPath = path.join(UNPLACED_DIR, `${Date.now()}_${path.basename(localPath)}`);
  await fs.copy(localPath, tempPath);

  const photoId = `pu_${Date.now()}`;
  pendingPhotos.set(photoId, {
    localPath: tempPath, projectName, pengirim, caption, placed: false
  });

  // Ambil 6 desa teratas sebagai tombol
  const allDesa = await getAllDesa(projectName);
  const topDesa = allDesa.slice(0, 6);

  const desaRows = [];
  const row1 = topDesa.slice(0, 3).map(d => ({
    text: d.nama.replace(/^DESA\s+/i, ""),
    callback_data: `pa:place:${photoId}:${d.drive_id}:${encodeURIComponent(d.nama).substring(0, 20)}`
  }));
  const row2 = topDesa.slice(3, 6).map(d => ({
    text: d.nama.replace(/^DESA\s+/i, ""),
    callback_data: `pa:place:${photoId}:${d.drive_id}:${encodeURIComponent(d.nama).substring(0, 20)}`
  }));
  if (row1.length > 0) desaRows.push(row1);
  if (row2.length > 0) desaRows.push(row2);
  desaRows.push([{ text: "⏭️ Skip", callback_data: `pa:skip:${photoId}` }]);

  await notifyTelegram(
    `📸 <b>FOTO MASUK — PERLU PENEMPATAN</b>\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `👤 Dari: ${pengirim}\n` +
    `💬 Caption: ${caption || "(tidak ada caption)"}\n` +
    `⏰ ${timeStr} WITA\n` +
    `❓ <b>Tempatkan di desa mana?</b>`,
    desaRows
  );

  return { placed: false, pending: true, photo_id: photoId };
}

async function getPendingPhoto(photoId) {
  return pendingPhotos.get(photoId) || null;
}

async function confirmPhotoPlacement(photoId, desaDriveId, desaNama, projectName) {
  const pending = pendingPhotos.get(photoId);
  if (!pending) return null;

  const placed = await placePhotoToDrive(
    pending.localPath, projectName || pending.projectName,
    desaNama, desaDriveId,
    pending.pengirim, pending.caption
  );

  pendingPhotos.delete(photoId);
  return { ...placed, desa: desaNama };
}

async function clearPendingPhoto(photoId) {
  pendingPhotos.delete(photoId);
}

module.exports = {
  handleIncomingPhoto,
  detectDesaFromCaption,
  getPendingPhoto,
  confirmPhotoPlacement,
  clearPendingPhoto,
  placePhotoToDrive
};
