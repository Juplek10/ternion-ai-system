require("dotenv").config();

const fs = require("fs");
const path = require("path");

const {
  google,
  oauth2Client
} = require("./google");

oauth2Client.setCredentials(
  JSON.parse(
    fs.readFileSync(
      "/root/ai-system/tokens/google-token.json"
    )
  )
);

const drive = google.drive({
  version: "v3",
  auth: oauth2Client
});

/*
===================================
LIST FILES
===================================
*/

async function listFiles() {
  const res = await drive.files.list({
    pageSize: 20,
    fields: "files(id,name,mimeType,size,modifiedTime,parents)"
  });
  return res.data.files;
}

async function listFilesInFolder(folderId = "root") {
  const q = folderId === "root"
    ? "'root' in parents and trashed=false"
    : `'${folderId}' in parents and trashed=false`;
  const res = await drive.files.list({
    q,
    pageSize: 25,
    orderBy: "folder,name",
    fields: "files(id,name,mimeType,size,modifiedTime)"
  });
  return res.data.files || [];
}

async function getFileInfo(fileId) {
  const res = await drive.files.get({
    fileId,
    fields: "id,name,mimeType,size,modifiedTime,webViewLink"
  });
  return res.data;
}

async function deleteFile(fileId) {
  await drive.files.delete({ fileId });
  return true;
}

async function getDownloadLink(fileId) {
  return `https://drive.google.com/uc?id=${fileId}&export=download`;
}

/*
===================================
CREATE FOLDER
===================================
*/

async function createFolder(name) {

  const fileMetadata = {
    name,
    mimeType:
      "application/vnd.google-apps.folder"
  };

  const response =
    await drive.files.create({
      resource: fileMetadata,
      fields: "id,name"
    });

  return response.data;
}

/*
===================================
UPLOAD FILE
===================================
*/

async function uploadFile(
  filePath,
  folderId = null
) {

  try {

    const fileMetadata = {
      name: path.basename(filePath)
    };

    if (folderId) {
      fileMetadata.parents = [folderId];
    }

    const media = {
      mimeType:
        "application/octet-stream",
      body:
        fs.createReadStream(filePath)
    };

    const response =
      await drive.files.create({
        resource: fileMetadata,
        media,
        fields: "id,name"
      });

    return response.data;

  } catch (error) {

    console.log(
      "DRIVE UPLOAD ERROR:",
      error
    );

    return null;
  }
}

/*
===================================
EXPORTS
===================================
*/

module.exports = {
  drive,
  listFiles,
  listFilesInFolder,
  getFileInfo,
  deleteFile,
  getDownloadLink,
  createFolder,
  uploadFile
};
