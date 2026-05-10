const path = require("path");

async function executeAgent(
  agentName,
  input
) {

  try {

    const agentPath =
      path.join(
        "/root/ai-system/agents",
        agentName,
        `${agentName}.js`
      );

    const agent =
      require(agentPath);

    const result =
      await agent(input);

    return {
      success: true,
      agent: agentName,
      result
    };

  } catch(err) {

    return {
      success: false,
      error: err.message
    };
  }
}

module.exports =
  executeAgent;
