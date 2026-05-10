const fs = require("fs-extra");
const path = require("path");

const BACKUP_DIR =
  "/root/ai-system/backups";

const BASE_DIR =
  "/root/ai-system";

async function rollbackFile(
  relativePath
) {

  const files =
    await fs.readdir(
      BACKUP_DIR
    );

  const target =
    relativePath
      .replace(/\//g, "_");

  const matching =
    files
      .filter(
        f =>
          f.includes(target)
      )
      .sort()
      .reverse();

  if(
    matching.length === 0
  ) {

    return {

      success: false,

      error:
        "No backup found"
    };
  }

  const latest =
    matching[0];

  const backupPath =
    path.join(
      BACKUP_DIR,
      latest
    );

  const originalPath =
    path.join(
      BASE_DIR,
      relativePath
    );

  await fs.copy(
    backupPath,
    originalPath
  );

  return {

    success: true,

    restoredFrom:
      latest
  };
}

module.exports = {
  rollbackFile
};
