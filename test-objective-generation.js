const {

  generateObjectives

} = require(

  "./core/objective-generation-engine"
);

const civilizations = [

  {
    name:
      "Distributed Expansion",

    limitedDistributedCognition: true,

    slowDebuggingRecovery: false,

    researchStagnation: false,

    weakFederationCoordination: false
  },

  {
    name:
      "Debugging Crisis",

    limitedDistributedCognition: false,

    slowDebuggingRecovery: true,

    researchStagnation: false,

    weakFederationCoordination: false
  },

  {
    name:
      "Research Stagnation",

    limitedDistributedCognition: false,

    slowDebuggingRecovery: false,

    researchStagnation: true,

    weakFederationCoordination: false
  },

  {
    name:
      "Stable Civilization",

    limitedDistributedCognition: false,

    slowDebuggingRecovery: false,

    researchStagnation: false,

    weakFederationCoordination: false
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

      generateObjectives(
        civilization
      ),

      null,

      2
    )
  );
}
