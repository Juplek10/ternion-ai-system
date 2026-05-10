const fs = require("fs-extra");
const path = require("path");

const BASE_DIR =
  "/root/ai-system";

const BACKUP_DIR =
  "/root/ai-system/backups";

async function backupFile(
  relativePath
) {

  const source =
    path.join(
      BASE_DIR,
      relativePath
    );

  const timestamp =
    Date.now();

  const backupName =
    relativePath
      .replace(/\//g, "_");

  const destination =
    path.join(
      BACKUP_DIR,
      `${timestamp}_${backupName}`
    );

  await fs.copy(
    source,
    destination
  );

  return {
    success: true,
    backup:
      destination
  };
}

module.exports = {
  backupFile
};
