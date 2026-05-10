const fs = require("fs-extra");

const {
  backupFile
} = require(
  "./backup-engine"
);

const BASE_DIR =
  "/root/ai-system";

async function editFile(
  relativePath,
  searchText,
  replaceText
) {

  const fullPath =
    `${BASE_DIR}/${relativePath}`;

  await backupFile(
    relativePath
  );

  let content =
    await fs.readFile(
      fullPath,
      "utf8"
    );

  if(
    !content.includes(
      searchText
    )
  ) {

    return {
      success: false,
      message:
        "Search text not found"
    };
  }

  content =
    content.replace(
      searchText,
      replaceText
    );

  await fs.writeFile(
    fullPath,
    content
  );

  return {
    success: true,
    file:
      relativePath
  };
}

module.exports = {
  editFile
};
