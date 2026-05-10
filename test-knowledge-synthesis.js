const {

  synthesizeKnowledge

} = require(

  "./core/knowledge-synthesis-engine"
);

const ecosystems = [

  {
    name:
      "Distributed Healing",

    distributedDebugging: true,

    predictiveRecovery: true,

    governanceOptimization: false,

    runtimeBalancing: false,

    autonomousResearch: false,

    experimentation: false
  },

  {
    name:
      "Adaptive Civilization",

    distributedDebugging: false,

    predictiveRecovery: false,

    governanceOptimization: true,

    runtimeBalancing: true,

    autonomousResearch: false,

    experimentation: false
  },

  {
    name:
      "Scientific Civilization",

    distributedDebugging: false,

    predictiveRecovery: false,

    governanceOptimization: false,

    runtimeBalancing: false,

    autonomousResearch: true,

    experimentation: true
  },

  {
    name:
      "Stable Ecosystem",

    distributedDebugging: false,

    predictiveRecovery: false,

    governanceOptimization: false,

    runtimeBalancing: false,

    autonomousResearch: false,

    experimentation: false
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

      synthesizeKnowledge(
        ecosystem
      ),

      null,

      2
    )
  );
}
