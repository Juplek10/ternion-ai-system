const {
  getAgents
} = require("./core/agents");

async function test() {

  const agents =
    await getAgents();

  console.log(agents);
}

test();
