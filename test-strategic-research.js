const {

  conductResearch

} = require(

  "./core/strategic-research-engine"
);

const ecosystems = [

  {
    name:
      "Governance Bottleneck",

    governanceInefficiency: true,

    slowDebugging: false,

    toolchainLimitations: false,

    runtimeInstability: false
  },

  {
    name:
      "Slow Debugging",

    governanceInefficiency: false,

    slowDebugging: true,

    toolchainLimitations: false,

    runtimeInstability: false
  },

  {
    name:
      "Toolchain Limits",

    governanceInefficiency: false,

    slowDebugging: false,

    toolchainLimitations: true,

    runtimeInstability: false
  },

  {
    name:
      "Stable Ecosystem",

    governanceInefficiency: false,

    slowDebugging: false,

    toolchainLimitations: false,

    runtimeInstability: false
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

      conductResearch(
        ecosystem
      ),

      null,

      2
    )
  );
}
