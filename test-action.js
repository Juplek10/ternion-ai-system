const runAction =
  require("./core/action-engine");

async function test() {

  const result =
    await runAction(
      "Buat markdown roadmap proyek gudang baja"
    );

  console.log(result);
}

test();
