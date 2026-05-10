const {

  evolveParadigm

} = require(

  "./core/paradigm-evolution-engine"
);

const civilizations = [

  {
    name:
      "Unstable Federation",

    federatedInstability: true,

    slowScientificProgress: false,

    rigidGovernance: false,

    fragmentedKnowledge: false
  },

  {
    name:
      "Slow Scientific Civilization",

    federatedInstability: false,

    slowScientificProgress: true,

    rigidGovernance: false,

    fragmentedKnowledge: false
  },

  {
    name:
      "Rigid Governance",

    federatedInstability: false,

    slowScientificProgress: false,

    rigidGovernance: true,

    fragmentedKnowledge: false
  },

  {
    name:
      "Stable Civilization",

    federatedInstability: false,

    slowScientificProgress: false,

    rigidGovernance: false,

    fragmentedKnowledge: false
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

      evolveParadigm(
        civilization
      ),

      null,

      2
    )
  );
}
