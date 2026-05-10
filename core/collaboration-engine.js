const routeAgent =
  require(
    "./agent-router"
  );

const buildCapability =
  require(
    "./capability-builder"
  );

async function collaborate(
  workflow
) {

  const results = [];

  for(const step of workflow) {

    console.log(
      "\n===================="
    );

    console.log(
      "RUNNING AGENT"
    );

    console.log(
      step.agent
    );

    console.log(
      "===================="
    );

    let result =
      await routeAgent(
        step.agent,
        step.input
      );

    if(
      !result.success
    ) {

      console.log(
        "AGENT MISSING"
      );

      console.log(
        "BUILDING CAPABILITY"
      );

      await buildCapability(
        step.agent
      );

      result =
        await routeAgent(
          step.agent,
          step.input
        );
    }

    results.push({

      agent:
        step.agent,

      result
    });
  }

  return results;
}

module.exports = {
  collaborate
};
