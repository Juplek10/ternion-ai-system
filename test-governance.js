const runWorkflow =
  require(
    "./core/workflow-engine"
  );

async function test() {

  const result =
    await runWorkflow(
      "Restart worker service"
    );

  console.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );
}

test();
