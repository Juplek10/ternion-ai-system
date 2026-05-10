const {
  orchestrate
} = require(
  "./core/multi-agent-orchestrator"
);

async function test() {

  const result =

    await orchestrate(

      "Bangun strategi proyek gudang baja"
    );

  console.log(
    "\nFINAL RESULT\n"
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
