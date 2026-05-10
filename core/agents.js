const fs = require("fs-extra");

const AGENT_FILE =
  "/root/ai-system/agents/registry.json";

async function registerAgent(agent) {

  let agents = [];

  try {

    agents =
      await fs.readJson(AGENT_FILE);

  } catch(err) {

    agents = [];

  }

  agents.push({
    id: Date.now(),
    createdAt:
      new Date().toISOString(),
    ...agent
  });

  await fs.writeJson(
    AGENT_FILE,
    agents,
    { spaces: 2 }
  );

  return true;
}

async function getAgents() {

  try {

    return await fs.readJson(
      AGENT_FILE
    );

  } catch(err) {

    return [];
  }
}

module.exports = {
  registerAgent,
  getAgents
};
