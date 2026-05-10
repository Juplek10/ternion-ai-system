const runWorkflow =
  require(
    "./core/workflow-engine"
  );

async function test() {

  const result =
    await runWorkflow(
      "Analisa vendor proyek"
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
