const buildCapability =
  require(
    "./core/capability-builder"
  );

async function test() {

  const result =
    await buildCapability(
      "pdf-agent"
    );

  console.log(result);
}

test();
