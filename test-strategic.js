const {
  buildReasoningContext
} = require(
  "./core/reasoning-engine"
);

const {
  buildStrategicResponse
} = require(
  "./core/strategic-engine"
);

async function test() {

  const context =
    await buildReasoningContext(

      "Analisa vendor beton untuk proyek gudang"
    );

  const strategy =
    buildStrategicResponse(
      context
    );

  console.log(
    JSON.stringify(
      strategy,
      null,
      2
    )
  );
}

test();
