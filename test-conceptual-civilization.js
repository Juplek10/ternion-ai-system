const {

  buildConceptualFramework

} = require(

  "./core/conceptual-civilization-engine"
);

const civilizations = [

  {
    name:
      "Federated Intelligence",

    distributedCognition: true,

    adaptiveGovernance: true,

    predictiveRecovery: false,

    recursiveDebugging: false,

    autonomousResearch: false,

    scientificEvolution: false
  },

  {
    name:
      "Anticipatory Engineering",

    distributedCognition: false,

    adaptiveGovernance: false,

    predictiveRecovery: true,

    recursiveDebugging: true,

    autonomousResearch: false,

    scientificEvolution: false
  },

  {
    name:
      "Scientific Intelligence",

    distributedCognition: false,

    adaptiveGovernance: false,

    predictiveRecovery: false,

    recursiveDebugging: false,

    autonomousResearch: true,

    scientificEvolution: true
  },

  {
    name:
      "Stable Civilization",

    distributedCognition: false,

    adaptiveGovernance: false,

    predictiveRecovery: false,

    recursiveDebugging: false,

    autonomousResearch: false,

    scientificEvolution: false
  }
];

for(
  const civilization
  of civilizations
) {

  console.log(

    "\nCIVILIZATION:",

    civilization.name
  );

  console.log(

    JSON.stringify(

      buildConceptualFramework(
        civilization
      ),

      null,

      2
    )
  );
}
