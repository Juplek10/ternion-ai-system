require("dotenv").config();

const fs   = require("fs");
const path = require("path");

const { uploadFile } = require("./drive");

const WATCH_DIR     = "/root/ai-system/workspace/uploads";
const REGISTRY_PATH = "/root/ai-system/memory/file-registry.json";
const TERNION_FOLDER_ID = "1uhQqVyEqgCXHxA_ElyCqwbxO-1nwzb1p";

// -------------------------------------------------------
// Global error guards — cegah crash dari unhandled error
// -------------------------------------------------------

process.on("uncaughtException", (err) => {
  console.error("[DRIVE-WATCHER] uncaughtException:", err.message);
});

process.on("unhandledRejection", (reason) => {
  console.error("[DRIVE-WATCHER] unhandledRejection:", reason instanceof Error ? reason.message : String(reason));
});

// -------------------------------------------------------
// Registry helpers
// -------------------------------------------------------

function loadRegistry() {
  if (!fs.existsSync(REGISTRY_PATH)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf8"));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function saveRegistry(registry) {
  try {
    fs.writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2));
  } catch (err) {
    console.error("[DRIVE-WATCHER] Gagal simpan registry:", err.message);
  }
}

function isAlreadyUploaded(registry, fileName) {
  return registry.some(r => r.fileName === fileName && r.driveId);
}

// -------------------------------------------------------
// Upload dengan exponential backoff
// -------------------------------------------------------

async function uploadWithRetry(filePath, folderId, maxRetries = 3) {
  let delay = 5000;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await uploadFile(filePath, folderId);
      return result;
    } catch (err) {
      const isRateLimit = err.message && (
        err.message.includes("rate") ||
        err.message.includes("quota") ||
        err.message.includes("429")
      );
      console.error(`[DRIVE-WATCHER] Upload gagal (attempt ${attempt}/${maxRetries}): ${err.message}`);
      if (attempt < maxRetries) {
        const waitMs = isRateLimit ? delay * 3 : delay;
        console.log(`[DRIVE-WATCHER] Retry dalam ${waitMs / 1000}s...`);
        await new Promise(r => setTimeout(r, waitMs));
        delay *= 2;
      }
    }
  }
  return null;
}

// -------------------------------------------------------
// Upload handler
// -------------------------------------------------------

async function handleNewFile(fileName) {
  try {
    const filePath = path.join(WATCH_DIR, fileName);

    // Abaikan file sementara / hidden / direktori
    if (fileName.startsWith(".") || fileName.startsWith("~")) return;
    if (!fs.existsSync(filePath)) return;
    if (fs.statSync(filePath).isDirectory()) return;

    const registry = loadRegistry();
    if (isAlreadyUploaded(registry, fileName)) {
      console.log(`[DRIVE-WATCHER] Sudah terupload, skip: ${fileName}`);
      return;
    }

    console.log(`[DRIVE-WATCHER] File baru terdeteksi: ${fileName}`);
    console.log(`[DRIVE-WATCHER] Mengupload ke folder TERNION-AI...`);

    const result = await uploadWithRetry(filePath, TERNION_FOLDER_ID);

    if (!result) {
      console.error(`[DRIVE-WATCHER] Upload gagal setelah semua retry: ${fileName}`);
      return;
    }

    const entry = {
      fileName,
      localPath: filePath,
      driveId:   result.id,
      driveName: result.name,
      folderId:  TERNION_FOLDER_ID,
      uploadedAt: new Date().toISOString()
    };

    registry.push(entry);
    saveRegistry(registry);

    console.log(`[DRIVE-WATCHER] Upload berhasil!`);
    console.log(`[DRIVE-WATCHER]   Drive ID : ${result.id}`);
    console.log(`[DRIVE-WATCHER]   File     : ${result.name}`);

  } catch (err) {
    console.error(`[DRIVE-WATCHER] Error tidak terduga di handleNewFile: ${err.message}`);
  }
}

// -------------------------------------------------------
// Scan file yang sudah ada saat watcher start
// -------------------------------------------------------

async function scanExistingFiles() {
  try {
    if (!fs.existsSync(WATCH_DIR)) {
      fs.mkdirSync(WATCH_DIR, { recursive: true });
      return;
    }

    const registry = loadRegistry();
    const files    = fs.readdirSync(WATCH_DIR);

    for (const fileName of files) {
      if (!isAlreadyUploaded(registry, fileName)) {
        await handleNewFile(fileName);
      }
    }
  } catch (err) {
    console.error("[DRIVE-WATCHER] Error saat scan awal:", err.message);
  }
}

// -------------------------------------------------------
// Health check setiap 10 menit — pastikan watcher masih aktif
// -------------------------------------------------------

let watcherActive = false;

setInterval(() => {
  if (watcherActive) {
    console.log(`[DRIVE-WATCHER] Health OK — watcher aktif @ ${new Date().toISOString()}`);
  } else {
    console.error("[DRIVE-WATCHER] ALERT: watcher tidak aktif!");
  }
}, 10 * 60 * 1000);

// -------------------------------------------------------
// Watcher utama
// -------------------------------------------------------

console.log(`[DRIVE-WATCHER] Memulai pemantauan: ${WATCH_DIR}`);
console.log(`[DRIVE-WATCHER] Target Drive: TERNION-AI (${TERNION_FOLDER_ID})`);

scanExistingFiles().then(() => {
  try {
    fs.watch(WATCH_DIR, async (event, fileName) => {
      if (event === "rename" && fileName) {
        setTimeout(() => handleNewFile(fileName), 1500);
      }
    });

    watcherActive = true;
    console.log(`[DRIVE-WATCHER] Watcher aktif. Menunggu file baru...`);
  } catch (err) {
    console.error("[DRIVE-WATCHER] Gagal start watcher:", err.message);
  }
}).catch(err => {
  console.error("[DRIVE-WATCHER] Error saat scan awal:", err.message);
});

process.on("SIGINT",  () => { console.log("[DRIVE-WATCHER] Berhenti (SIGINT)."); process.exit(0); });
process.on("SIGTERM", () => { console.log("[DRIVE-WATCHER] Berhenti (SIGTERM)."); process.exit(0); });
