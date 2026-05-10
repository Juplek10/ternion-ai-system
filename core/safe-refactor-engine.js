const fs =
  require("fs");

const path =
  require("path");

function backupFile(
  filePath
) {

  const backupPath =

    filePath +
    ".backup";

  fs.copyFileSync(
    filePath,
    backupPath
  );

  return backupPath;
}

function safeRefactor({

  filePath,

  search,

  replace
}) {

  if(
    !fs.existsSync(
      filePath
    )
  ) {

    return {

      success: false,

      error:
        "File not found"
    };
  }

  const backup =

    backupFile(
      filePath
    );

  try {

    let content =

      fs.readFileSync(
        filePath,
        "utf8"
      );

    const occurrences =

      (
        content.match(
          new RegExp(
            search,
            "g"
          )
        ) || []
      ).length;

    content =
      content.replace(

        new RegExp(
          search,
          "g"
        ),

        replace
      );

    fs.writeFileSync(

      filePath,

      content
    );

    return {

      success: true,

      backup,

      occurrences
    };

  } catch(err) {

    fs.copyFileSync(
      backup,
      filePath
    );

    return {

      success: false,

      rollback: true,

      error:
        err.toString()
    };
  }
}

module.exports = {
  safeRefactor
};
