
const {

  orchestrateEcosystem

} = require(

  "./core/orchestration-core"
);

const ecosystems = [

  {
    name:
      "Runtime Crisis",

    runtimeFailure: true,

    infrastructureOverload: false,

    debuggingFailures: false,

    evolutionNeeded: false,

    researchRequired: false,

    experimentationNeeded: false
  },

  {
    name:
      "Infrastructure Overload",

    runtimeFailure: false,

    infrastructureOverload: true,

    debuggingFailures: false,

    evolutionNeeded: false,

    researchRequired: false,

    experimentationNeeded: false
  },

  {
    name:
      "Evolution Civilization",

    runtimeFailure: false,

    infrastructureOverload: false,

    debuggingFailures: true,

    evolutionNeeded: true,

    researchRequired: true,

    experimentationNeeded: true
  },

  {
    name:
      "Stable Civilization",

    runtimeFailure: false,

    infrastructureOverload: false,

    debuggingFailures: false,

    evolutionNeeded: false,

    researchRequired: false,

    experimentationNeeded: false
  }
];

for(
  const ecosystem
  of ecosystems
) {

  console.log(

    "\nECOSYSTEM:",

    ecosystem.name
  );

  console.log(

    JSON.stringify(

      orchestrateEcosystem(
        ecosystem
      ),

      null,

      2
    )
  );
}
