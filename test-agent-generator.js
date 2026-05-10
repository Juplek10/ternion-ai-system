const generateAgent =
  require(
    "./core/generators/agent-generator"
  );

async function test() {

  const result =
    await generateAgent(
      "vendor-agent"
    );

  console.log(result);
}

test();

