const fs =
  require("fs");

const file =

  "/root/ai-system/civilization-scenarios.json";

function loadScenarios() {

  return JSON.parse(

    fs.readFileSync(
      file,
      "utf8"
    )
  );
}

function simulateCivilization() {

  const data =
    loadScenarios();

  const simulations = [];

  for(
    const scenario
    of data.scenarios
  ) {

    let stability = 0;

    stability +=
      scenario.researchGrowth;

    stability +=
      scenario.governanceStrength * 2;

    stability +=
      scenario.operationsStability * 2;

    simulations.push({

      ...scenario,

      stabilityScore:
        stability
    });
  }

  simulations.sort(

    (
      a,
      b
    ) =>

      b.stabilityScore -
      a.stabilityScore
  );

  return {

    bestFuture:
      simulations[0],

    simulations
  };
}

module.exports = {
  simulateCivilization
};
