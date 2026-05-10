const {

  superviseEcosystem

} = require(

  "./ecosystem-supervisor"
);

const {

  orchestrateEcosystem

} = require(

  "./orchestration-core"
);

const {

  continuousEngineering

} = require(

  "./continuous-engineering-loop"
);

const {

  governCivilization

} = require(

  "./civilization-governor-engine"
);

function runAutonomousLoop(
  ecosystem
) {

  const runtimeCycle = {

    supervisor:

      superviseEcosystem(
        ecosystem
      ),

    orchestration:

      orchestrateEcosystem(
        ecosystem
      ),

    engineering:

      continuousEngineering(
        ecosystem
      ),

    governance:

      governCivilization(
        ecosystem
      )
  };

  return {

    autonomousRuntime:
      true,

    runtimeCycle
  };
}

module.exports = {
  runAutonomousLoop
};
