const {
  writeFile,
  readFile,
  createFolder,
  listFiles
} = require("./core/fs-tools");

async function test() {

  await createFolder(
    "sandbox"
  );

  await writeFile(
    "sandbox/test.md",
    "# Hello AI"
  );

  const content =
    await readFile(
      "sandbox/test.md"
    );

  console.log(content);

  const files =
    await listFiles(
      "sandbox"
    );

  console.log(files);
}

test();
