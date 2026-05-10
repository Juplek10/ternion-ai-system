const classifyTask =
  require(
    "./core/task-classifier"
  );

async function test() {

  const result =
    await classifyTask(
      "Fix worker error dan restart service"
    );

  console.log(result);
}

test();
