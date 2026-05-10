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

  const res =
    await drive.files.list({
      pageSize: 10,
      fields: "files(id,name,mimeType)"
    });

  return res.data.files;
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
  createFolder,
  uploadFile
};
