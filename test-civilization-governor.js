const {

  governCivilization

} = require(

  "./core/civilization-governor-engine"
);

const civilizations = [

  {
    name:
      "Scaling Civilization",

    infrastructureOverload: true,

    highDebuggingSuccess: false,

    researchStagnation: false,

    federationInstability: false
  },

  {
    name:
      "Engineering Civilization",

    infrastructureOverload: false,

    highDebuggingSuccess: true,

    researchStagnation: false,

    federationInstability: false
  },

  {
    name:
      "Research Crisis",

    infrastructureOverload: false,

    highDebuggingSuccess: false,

    researchStagnation: true,

    federationInstability: false
  },

  {
    name:
      "Stable Civilization",

    infrastructureOverload: false,

    highDebuggingSuccess: false,

    researchStagnation: false,

    federationInstability: false
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

      governCivilization(
        civilization
      ),

      null,

      2
    )
  );
}
