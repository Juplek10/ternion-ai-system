const {

  evolveEcosystem

} = require(

  "./core/recursive-evolution-loop"
);

const ecosystems = [

  {
    name:
      "Weak Debugging",

    debuggingWeakness: true,

    runtimeRecoverySlow: false,

    highFederationLatency: false,

    toolchainLimitations: false
  },

  {
    name:
      "Slow Recovery",

    debuggingWeakness: false,

    runtimeRecoverySlow: true,

    highFederationLatency: false,

    toolchainLimitations: false
  },

  {
    name:
      "Federation Bottleneck",

    debuggingWeakness: false,

    runtimeRecoverySlow: false,

    highFederationLatency: true,

    toolchainLimitations: false
  },

  {
    name:
      "Optimized Ecosystem",

    debuggingWeakness: false,

    runtimeRecoverySlow: false,

    highFederationLatency: false,

    toolchainLimitations: false
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

      evolveEcosystem(
        ecosystem
      ),

      null,

      2
    )
  );
}
