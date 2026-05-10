const planWorkflow =
  require(
    "./core/workflow-planner"
  );

async function test() {

  const result =
    await planWorkflow(
      "Analisa tender PDF dan vendor untuk RAB proyek"
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

