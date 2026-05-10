const {
  recoverSystem
} = require(
  "./core/recovery-engine"
);

async function test() {

  const result =
    await recoverSystem();

  console.log(result);
}

test();
