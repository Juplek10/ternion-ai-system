const executeAgent =
  require(
    "./core/agent-executor"
  );

async function test() {

  const result =
    await executeAgent(
      "vendor-agent",
      {
        vendor:
          "PT Maju Bersama"
      }
    );

  console.log(result);
}

test();

