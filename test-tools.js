const {
  getTools
} = require("./core/tools");

async function test() {

  const tools =
    await getTools();

  console.log(tools);
}

test();
