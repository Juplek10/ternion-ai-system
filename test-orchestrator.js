const orchestrate =
  require(
    "./core/orchestrator"
  );

async function test() {

  const result =
    await orchestrate(
      "Analisa PDF tender proyek"
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
