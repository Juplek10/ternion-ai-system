const routeAgent =
  require(
    "./core/agent-router"
  );

async function test() {

  const result =
    await routeAgent(
      "Analisa vendor proyek",
      {
        company:
          "PT Maju Bersama"
      }
    );

  console.log(result);
}

test();
