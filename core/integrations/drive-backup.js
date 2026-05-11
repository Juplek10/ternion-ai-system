require("dotenv").config();

const fs = require("fs");
const path = require("path");

const TOKEN_PATH = "/root/ai-system/tokens/google-token.json";

// Lazy-load drive — googleapis auto-refresh token via refresh_token
function getDrive() {
  const { google, oauth2Client } = require("./google");
  try {
    const tokenData = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf8"));
    oauth2Client.setCredentials(tokenData);
    return google.drive({ version: "v3", auth: oauth2Client });
  } catch (err) {
    throw new Error("Google token tidak tersedia: " + err.message);
  }
}

// Cache folder IDs agar tidak query ulang setiap kali
const folderCache = {};

async function findOrCreateFolder(drive, folderPath) {
  if (folderCache[folderPath]) return folderCache[folderPath];

  const parts = folderPath.split("/");
  let parentId = "root";

  for (const part of parts) {
    const cacheKey = `${parentId}/${part}`;
    if (folderCache[cacheKey]) {
      parentId = folderCache[cacheKey];
      continue;
    }

    // Cari folder yang sudah ada
    const res = await drive.files.list({
      q: `name='${part}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`,
      fields: "files(id,name)",
      pageSize: 1
    });

    let folderId;
    if (res.data.files && res.data.files.length > 0) {
      folderId = res.data.files[0].id;
    } else {
      // Buat folder baru
      const created = await drive.files.create({
        resource: { name: part, mimeType: "application/vnd.google-apps.folder", parents: [parentId] },
        fields: "id"
      });
      folderId = created.data.id;
    }

    folderCache[cacheKey] = folderId;
    parentId = folderId;
  }

  folderCache[folderPath] = parentId;
  return parentId;
}

async function uploadFile(localPath, driveFolderPath = "CORE-SYSTEM/memory") {
  const drive = getDrive();
  const folderId = await findOrCreateFolder(drive, driveFolderPath);
  const fileName = path.basename(localPath);

  // Cek apakah file sudah ada di Drive — jika ya, update
  const existing = await drive.files.list({
    q: `name='${fileName}' and '${folderId}' in parents and trashed=false`,
    fields: "files(id)",
    pageSize: 1
  });

  const media = {
    mimeType: "application/json",
    body: fs.createReadStream(localPath)
  };

  if (existing.data.files && existing.data.files.length > 0) {
    // Update existing file
    await drive.files.update({
      fileId: existing.data.files[0].id,
      media,
      fields: "id"
    });
  } else {
    // Upload baru
    await drive.files.create({
      resource: { name: fileName, parents: [folderId] },
      media,
      fields: "id"
    });
  }
}

module.exports = { uploadFile, findOrCreateFolder };
