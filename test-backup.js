const {
  backupFile
} = require(
  "./core/backup-engine"
);

async function test() {

  const result =
    await backupFile(
      "worker.js"
    );

  console.log(result);
}

test();
