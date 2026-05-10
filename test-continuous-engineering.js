const {

  continuousEngineering

} = require(

  "./core/continuous-engineering-loop"
);

const ecosystems = [

  {
    name:
      "Weak Debugging",

    weakDebugging: true,

    infrastructureAnalysisNeeded: false
  },

  {
    name:
      "Infrastructure Analysis",

    weakDebugging: false,

    infrastructureAnalysisNeeded: true
  },

  {
    name:
      "Stable Ecosystem",

    weakDebugging: false,

    infrastructureAnalysisNeeded: false
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

      continuousEngineering(
        ecosystem
      ),

      null,

      2
    )
  );
}
