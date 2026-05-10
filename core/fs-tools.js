const fs = require("fs-extra");
const path = require("path");

const BASE_DIR =
  "/root/ai-system";

function safePath(filePath) {

  const resolved =
    path.resolve(
      BASE_DIR,
      filePath
    );

  if(
    !resolved.startsWith(BASE_DIR)
  ) {

    throw new Error(
      "Access denied"
    );
  }

  return resolved;
}

async function readFile(filePath) {

  const fullPath =
    safePath(filePath);

  return await fs.readFile(
    fullPath,
    "utf8"
  );
}

async function writeFile(
  filePath,
  content
) {

  const fullPath =
    safePath(filePath);

  await fs.outputFile(
    fullPath,
    content
  );

  return true;
}

async function createFolder(
  folderPath
) {

  const fullPath =
    safePath(folderPath);

  await fs.mkdirp(
    fullPath
  );

  return true;
}

async function listFiles(
  folderPath = "."
) {

  const fullPath =
    safePath(folderPath);

  return await fs.readdir(
    fullPath
  );
}

module.exports = {
  readFile,
  writeFile,
  createFolder,
  listFiles
};

