const planWorkflow =
  require(
    "./workflow-planner"
  );

const {
  collaborate
} = require(
  "./collaboration-engine"
);

const {
  buildReasoningContext
} = require(
    "./reasoning-engine"
);

async function executeAutonomously(
  prompt
) {

  console.log(
    "\n===================="
  );

  console.log(
    "AUTONOMOUS EXECUTION"
  );

  console.log(
    prompt
  );

  console.log(
    "===================="
  );

  const reasoning =
    await buildReasoningContext(
      prompt
    );

  const workflow =
    await planWorkflow(
      prompt
    );

  const collaboration =
    await collaborate(
      workflow
    );

  return {

    prompt,

    reasoning,

    workflow,

    collaboration,

    summary:
      "Autonomous workflow completed"
  };
}

module.exports = {
  executeAutonomously
};
