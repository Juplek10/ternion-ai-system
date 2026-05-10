require("dotenv").config();

const fs = require("fs-extra");
const path = require("path");
const crypto = require("crypto");
const { google, oauth2Client } = require("./google");

const VAULT_PASSWORD = "Moyanik10";
const ROOT_FOLDER_NAME = "TERNION-AI";

// Sub-folder structure
const FOLDER_STRUCTURE = {
  "CORE-SYSTEM": ["memory", "agents", "skills", "tools", "config"],
  "DOCUMENTS": [],
  "PROJECTS": [],
  "UPLOADS": []
};

// ─── AES-256 Enkripsi ────────────────────────────────────
function encrypt(text) {
  const key = crypto.scryptSync(VAULT_PASSWORD, "ternion-salt", 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

function decrypt(encryptedText) {
  const [ivHex, encrypted] = encryptedText.split(":");
  const key = crypto.scryptSync(VAULT_PASSWORD, "ternion-salt", 32);
  const iv = Buffer.from(ivHex, "hex");
  const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

// ─── Inisialisasi Drive client ───────────────────────────
function getDriveClient() {
  try {
    const tokenPath = "/root/ai-system/tokens/google-token.json";
    const token = JSON.parse(fs.readFileSync(tokenPath, "utf8"));
    oauth2Client.setCredentials(token);
    return google.drive({ version: "v3", auth: oauth2Client });
  } catch (err) {
    throw new Error("Google token tidak tersedia: " + err.message);
  }
}

// ─── Cari atau buat folder di Drive ──────────────────────
async function getOrCreateFolder(drive, name, parentId = null) {
  const q = parentId
    ? `name='${name}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`
    : `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;

  const res = await drive.files.list({ q, fields: "files(id,name)", spaces: "drive" });

  if (res.data.files.length > 0) {
    return res.data.files[0].id;
  }

  // Buat folder baru
  const meta = {
    name,
    mimeType: "application/vnd.google-apps.folder",
    ...(parentId ? { parents: [parentId] } : {})
  };
  const created = await drive.files.create({ resource: meta, fields: "id" });
  console.log(`[VAULT] Folder dibuat: ${name}`);
  return created.data.id;
}

// ─── Setup struktur folder di Drive ──────────────────────
async function setupFolderStructure() {
  const drive = getDriveClient();

  // Buat root folder
  const rootId = await getOrCreateFolder(drive, ROOT_FOLDER_NAME);
  const folderIds = { root: rootId };

  // Buat sub-folder
  for (const [folderName, subfolders] of Object.entries(FOLDER_STRUCTURE)) {
    const folderId = await getOrCreateFolder(drive, folderName, rootId);
    folderIds[folderName] = folderId;

    for (const sub of subfolders) {
      const subId = await getOrCreateFolder(drive, sub, folderId);
      folderIds[`${folderName}/${sub}`] = subId;
    }
  }

  return folderIds;
}

// ─── Upload file ke Drive ────────────────────────────────
async function uploadToDrive(drive, localPath, fileName, folderId, encrypted = false) {
  try {
    let content = fs.readFileSync(localPath, "utf8");
    if (encrypted) {
      content = encrypt(content);
      fileName = fileName + ".enc";
    }

    // Hapus file lama dengan nama sama
    const existing = await drive.files.list({
      q: `name='${fileName}' and '${folderId}' in parents and trashed=false`,
      fields: "files(id)"
    });
    for (const f of existing.data.files) {
      await drive.files.delete({ fileId: f.id }).catch(() => {});
    }

    // Upload file baru
    const { Readable } = require("stream");
    const stream = Readable.from([content]);

    await drive.files.create({
      resource: { name: fileName, parents: [folderId] },
      media: { mimeType: "text/plain", body: stream },
      fields: "id"
    });

    return true;
  } catch (err) {
    console.error(`[VAULT] Gagal upload ${fileName}:`, err.message);
    return false;
  }
}

// ─── AUTO-BACKUP (dipanggil tiap 6 jam) ─────────────────
async function runBackup() {
  console.log("[VAULT] Mulai backup ke Drive...");

  let drive;
  try {
    drive = getDriveClient();
  } catch (err) {
    console.error("[VAULT] Tidak bisa connect Drive:", err.message);
    return { success: false, error: err.message };
  }

  let folderIds;
  try {
    folderIds = await setupFolderStructure();
  } catch (err) {
    console.error("[VAULT] Gagal setup folder:", err.message);
    return { success: false, error: err.message };
  }

  const results = { success: 0, failed: 0, files: [] };

  // Backup memory files (terenkripsi)
  const memoryFiles = [
    "/root/ai-system/memory/long-term.json",
    "/root/ai-system/memory/heartbeat-log.json"
  ];
  for (const filePath of memoryFiles) {
    if (!fs.existsSync(filePath)) continue;
    const fileName = path.basename(filePath);
    const ok = await uploadToDrive(drive, filePath, fileName, folderIds["CORE-SYSTEM/memory"], true);
    ok ? results.success++ : results.failed++;
    results.files.push({ file: fileName, ok, encrypted: true });
  }

  // Backup dream reports (terenkripsi)
  const dreamsDir = "/root/ai-system/memory/dreams";
  if (fs.existsSync(dreamsDir)) {
    const dreamFiles = fs.readdirSync(dreamsDir).filter(f => f.endsWith(".json")).slice(-7); // 7 hari terakhir
    for (const fileName of dreamFiles) {
      const filePath = path.join(dreamsDir, fileName);
      const ok = await uploadToDrive(drive, filePath, fileName, folderIds["CORE-SYSTEM/memory"], true);
      ok ? results.success++ : results.failed++;
      results.files.push({ file: fileName, ok, encrypted: true });
    }
  }

  // Backup config (terenkripsi)
  const configFiles = [
    "/root/ai-system/.env",
    "/root/ai-system/prompts/ternion-soul.txt"
  ];
  for (const filePath of configFiles) {
    if (!fs.existsSync(filePath)) continue;
    const fileName = path.basename(filePath);
    const ok = await uploadToDrive(drive, filePath, fileName, folderIds["CORE-SYSTEM/config"], true);
    ok ? results.success++ : results.failed++;
    results.files.push({ file: fileName, ok, encrypted: true });
  }

  const timestamp = new Date().toISOString();
  console.log(`[VAULT] Backup selesai: ${results.success} berhasil, ${results.failed} gagal`);

  return { success: true, timestamp, ...results };
}

// ─── Export untuk telegram command /backup ───────────────
async function getBackupStatus() {
  try {
    const drive = getDriveClient();
    const rootFolders = await drive.files.list({
      q: `name='${ROOT_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: "files(id,name,modifiedTime)"
    });
    if (rootFolders.data.files.length === 0) return { exists: false };
    return { exists: true, modified: rootFolders.data.files[0].modifiedTime };
  } catch (err) {
    return { exists: false, error: err.message };
  }
}

module.exports = { runBackup, setupFolderStructure, encrypt, decrypt, getBackupStatus };
