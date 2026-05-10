const {
  executeAutonomously
} = require(
  "./core/autonomous-executor"
);

async function test() {

  const result =
    await executeAutonomously(
      "Analisa vendor dan tender PDF untuk RAB proyek gudang"
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
