const {

  superviseEcosystem

} = require(

  "./core/ecosystem-supervisor"
);

const ecosystems = [

  {
    name:
      "Runtime Crisis",

    runtimeOverload: true,

    debuggingFailures: false,

    researchStagnation: false,

    federationInstability: false
  },

  {
    name:
      "Debugging Collapse",

    runtimeOverload: false,

    debuggingFailures: true,

    researchStagnation: false,

    federationInstability: false
  },

  {
    name:
      "Scientific Stagnation",

    runtimeOverload: false,

    debuggingFailures: false,

    researchStagnation: true,

    federationInstability: false
  },

  {
    name:
      "Stable Ecosystem",

    runtimeOverload: false,

    debuggingFailures: false,

    researchStagnation: false,

    federationInstability: false
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

      superviseEcosystem(
        ecosystem
      ),

      null,

      2
    )
  );
}
