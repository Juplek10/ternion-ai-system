const fs =
  require("fs");

const path =
  require("path");

function backupFile(
  filePath
) {

  const backupDir =
    "/root/ai-system/backups";

  if(
    !fs.existsSync(
      backupDir
    )
  ) {

    fs.mkdirSync(
      backupDir
    );
  }

  const fileName =
    path.basename(
      filePath
    );

  const backupPath =

    `${backupDir}/${
      Date.now()
    }_${fileName}`;

  fs.copyFileSync(
    filePath,
    backupPath
  );

  return backupPath;
}

function applyPatch(
  filePath,
  newContent
) {

  const backup =
    backupFile(
      filePath
    );

  fs.writeFileSync(
    filePath,
    newContent
  );

  return backup;
}

function rollback(
  filePath,
  backupPath
) {

  fs.copyFileSync(
    backupPath,
    filePath
  );

  return true;
}

module.exports = {

  backupFile,

  applyPatch,

  rollback
};
