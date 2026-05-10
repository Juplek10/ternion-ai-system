require("dotenv").config();

const fs   = require("fs");
const path = require("path");

const { uploadFile } = require("./drive");

const WATCH_DIR     = "/root/ai-system/workspace/uploads";
const REGISTRY_PATH = "/root/ai-system/memory/file-registry.json";
const TERNION_FOLDER_ID = "1uhQqVyEqgCXHxA_ElyCqwbxO-1nwzb1p";

// -------------------------------------------------------
// Registry helpers
// -------------------------------------------------------

function loadRegistry() {
  if (!fs.existsSync(REGISTRY_PATH)) return [];
  try {
    return JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf8"));
  } catch {
    return [];
  }
}

function saveRegistry(registry) {
  fs.writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2));
}

function isAlreadyUploaded(registry, fileName) {
  return registry.some(r => r.fileName === fileName && r.driveId);
}

// -------------------------------------------------------
// Upload handler
// -------------------------------------------------------

async function handleNewFile(fileName) {
  const filePath = path.join(WATCH_DIR, fileName);

  // Abaikan file sementara / hidden
  if (fileName.startsWith(".") || fileName.startsWith("~")) return;
  if (!fs.existsSync(filePath)) return;

  const registry = loadRegistry();
  if (isAlreadyUploaded(registry, fileName)) {
    console.log(`[DRIVE-WATCHER] Sudah terupload, skip: ${fileName}`);
    return;
  }

  console.log(`[DRIVE-WATCHER] File baru terdeteksi: ${fileName}`);
  console.log(`[DRIVE-WATCHER] Mengupload ke folder TERNION-AI...`);

  try {
    const result = await uploadFile(filePath, TERNION_FOLDER_ID);

    if (!result) {
      console.log(`[DRIVE-WATCHER] Upload gagal untuk: ${fileName}`);
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
    console.log(`[DRIVE-WATCHER]   Registry : ${REGISTRY_PATH}`);

  } catch (err) {
    console.log(`[DRIVE-WATCHER] Error saat upload: ${err.message}`);
  }
}

// -------------------------------------------------------
// Scan file yang sudah ada saat watcher start
// -------------------------------------------------------

async function scanExistingFiles() {
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
}

// -------------------------------------------------------
// Watcher utama
// -------------------------------------------------------

console.log(`[DRIVE-WATCHER] Memulai pemantauan: ${WATCH_DIR}`);
console.log(`[DRIVE-WATCHER] Target Drive: TERNION-AI (${TERNION_FOLDER_ID})`);

scanExistingFiles().then(() => {
  fs.watch(WATCH_DIR, async (event, fileName) => {
    if (event === "rename" && fileName) {
      // Tunggu singkat agar file selesai ditulis sebelum diupload
      setTimeout(() => handleNewFile(fileName), 1500);
    }
  });

  console.log(`[DRIVE-WATCHER] Watcher aktif. Menunggu file baru...`);
});

process.on("SIGINT",  () => { console.log("[DRIVE-WATCHER] Berhenti."); process.exit(0); });
process.on("SIGTERM", () => { console.log("[DRIVE-WATCHER] Berhenti."); process.exit(0); });
