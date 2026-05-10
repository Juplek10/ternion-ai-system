const fs = require("fs-extra");
const path = require("path");

const AGENT_DIR =
  "/root/ai-system/agents";

async function routeAgent(
  agentName,
  input
) {

  try {

    const agentPath =
      path.join(
        AGENT_DIR,
        agentName,
        "index.js"
      );

    const exists =
      await fs.pathExists(
        agentPath
      );

    if(!exists) {

      return {

        success: false,

        message:
          "No suitable agent found"
      };
    }

    delete require.cache[
      require.resolve(
        agentPath
      )
    ];

    const agent =
      require(agentPath);

    const result =
      await agent.run(
        input
      );

    return {

      success: true,

      agent:
        agentName,

      result
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
  routeAgent;
