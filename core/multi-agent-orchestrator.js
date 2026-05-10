const agents = {

  planner: require(
    "./reasoning-engine"
  ),

  strategic: require(
    "./strategic-engine"
  ),

  improvement: require(
    "./auto-improvement-loop"
  )
};

async function orchestrate(
  objective
) {

  console.log(
    "\n===================="
  );

  console.log(
    "MULTI AGENT ORCHESTRATION"
  );

  console.log(
    "====================\n"
  );

  const plannerResult =

    await agents.planner
      .buildReasoningContext(
        objective
      );

  console.log(
    "\nPLANNER RESULT\n"
  );

  console.log(
    JSON.stringify(
      plannerResult,
      null,
      2
    )
  );

  const strategicResult =

    agents.strategic
      .buildStrategicAnalysis(

        plannerResult
      );

  console.log(
    "\nSTRATEGIC RESULT\n"
  );

  console.log(
    JSON.stringify(
      strategicResult,
      null,
      2
    )
  );

  const improvementResult =

    agents.improvement
      .runAutoImprovement();

  console.log(
    "\nIMPROVEMENT RESULT\n"
  );

  console.log(
    JSON.stringify(
      improvementResult,
      null,
      2
    )
  );

  return {

    success: true,

    plannerResult,

    strategicResult,

    improvementResult
  };
}

module.exports = {
  orchestrate
};
