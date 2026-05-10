const fs = require("fs-extra");
const path = require("path");

const AGENT_DIR =
  "/root/ai-system/agents";

async function buildCapability(
  agentName
) {

  try {

    const agentPath =
      path.join(
        AGENT_DIR,
        agentName
      );

    await fs.ensureDir(
      agentPath
    );

    const indexPath =
      path.join(
        agentPath,
        "index.js"
      );

    const code = `
async function run(input) {

  return {

    success: true,

    agent:
      "${agentName}",

    input
  };
}

module.exports = {
  run
};
`;

    await fs.writeFile(
      indexPath,
      code
    );

    return {

      success: true,

      agent:
        agentName
    };

  } catch(err) {

    return {

      success: false,

      error:
        err.message
    };
  }
}

module.exports =
  buildCapability;

