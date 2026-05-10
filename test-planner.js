const planTool =
  require("./core/tool-planner");

async function test() {

  const plan =
    await planTool(
      "Buat file markdown roadmap proyek"
    );

  console.log(plan);
}

test();
