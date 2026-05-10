const planTool =
  require("./tool-planner");

const executeTool =
  require("./tool-executor");

async function runAction(
  prompt
) {

  const plan =
    await planTool(prompt);

  if(!plan) {

    return {
      success: false,
      message:
        "No suitable tool found"
    };
  }

  const result =
    await executeTool(
      plan.tool,
      plan.params
    );

  return {
    success: true,
    tool:
      plan.tool,
    result
  };
}

module.exports =
  runAction;
