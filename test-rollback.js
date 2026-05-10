const {
  rollbackFile
} = require(
  "./core/rollback-engine"
);

async function test() {

  const result =
    await rollbackFile(
      "sandbox/generated.md"
    );

  console.log(result);
}

test();

