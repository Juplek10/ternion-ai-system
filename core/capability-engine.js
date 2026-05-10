const {
  getTools
} = require("./tools");

const {
  getAgents
} = require("./agents");

async function getCapabilities() {

  const tools =
    await getTools();

  const agents =
    await getAgents();

  return {

    totalTools:
      tools.length,

    totalAgents:
      agents.length,

    tools:
      tools.map(
        t => ({
          name: t.name,
          type: t.type
        })
      ),

    agents:
      agents.map(
        a => ({
          name: a.name,
          type: a.type
        })
      )
  };
}

module.exports = {
  getCapabilities
};
