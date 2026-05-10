const {
  buildReasoningContext
} = require(
  "./core/reasoning-engine"
);

async function test() {

  const context =
    await buildReasoningContext(

      "Analisa vendor beton proyek gudang"
    );

  console.log(
    JSON.stringify(
      context,
      null,
      2
    )
  );
}

test();

