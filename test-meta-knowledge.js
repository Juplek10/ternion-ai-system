const {

  evolveKnowledge

} = require(

  "./core/meta-knowledge-engine"
);

const knowledgeStates = [

  {
    name:
      "Fragmented Knowledge",

    fragmentedKnowledge: true,

    overlappingResearch: false,

    inefficientDebuggingCognition: false,

    weakFederationCoordination: false
  },

  {
    name:
      "Research Overlap",

    fragmentedKnowledge: false,

    overlappingResearch: true,

    inefficientDebuggingCognition: false,

    weakFederationCoordination: false
  },

  {
    name:
      "Weak Debugging Cognition",

    fragmentedKnowledge: false,

    overlappingResearch: false,

    inefficientDebuggingCognition: true,

    weakFederationCoordination: false
  },

  {
    name:
      "Optimized Knowledge",

    fragmentedKnowledge: false,

    overlappingResearch: false,

    inefficientDebuggingCognition: false,

    weakFederationCoordination: false
  }
];

for(
  const state
  of knowledgeStates
) {

  console.log(

    "\nKNOWLEDGE:",

    state.name
  );

  console.log(

    JSON.stringify(

      evolveKnowledge(
        state
      ),

      null,

      2
    )
  );
}
