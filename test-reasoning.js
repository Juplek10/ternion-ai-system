const {
  buildReasoningContext
} = require(
  "./core/reasoning-engine"
);

async function test() {

  const result =
    await buildReasoningContext(
      "Analisa vendor beton untuk RAB Gudang"
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
