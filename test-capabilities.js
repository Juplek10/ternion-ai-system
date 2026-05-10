const {
  getCapabilities
} = require(
  "./core/capability-engine"
);

async function test() {

  const capabilities =
    await getCapabilities();

  console.log(
    JSON.stringify(
      capabilities,
      null,
      2
    )
  );
}

test();
