const orchestrate =
  require("./orchestrator");

const buildCapability =
  require(
    "./capability-builder"
  );

const routeAgent =
  require(
    "./agent-router"
  );

const {
  createApproval
} = require(
  "./approval-engine"
);

const {
  evaluateRisk
} = require(
  "./governance-engine"
);

async function runWorkflow(
  prompt
) {

  const orchestration =
    await orchestrate(
      prompt
    );

  let buildResult =
    null;

  if(
    orchestration.nextAction ===
    "build-capability"
  ) {

    const missing =
      orchestration
        .capabilityGap
        .missing;

    if(missing.length > 0) {

      buildResult =
        await buildCapability(
          missing[0]
        );
    }
  }

  const risk =
    await evaluateRisk({
      orchestration
    });

  let approval =
    null;

  if(risk.risky) {

    approval =
      await createApproval({

        type:
          "workflow-execution",

        description:
          prompt,

        risk
      });
  }

  let execution =
    null;

  if(!risk.risky) {

    execution =
      await routeAgent(
        prompt,
        {
          task: prompt
        }
      );
  }

  return {

    orchestration,

    buildResult,

    risk,

    approval,

    execution
  };
}

module.exports =
  runWorkflow;
