const {

  runExperiment

} = require(

  "./core/experimentation-engine"
);

const experiments = [

  {
    name:
      "Distributed Debugging",

    distributedDebugging: true,

    predictiveRecovery: false,

    governanceOptimization: false
  },

  {
    name:
      "Predictive Recovery",

    distributedDebugging: false,

    predictiveRecovery: true,

    governanceOptimization: false
  },

  {
    name:
      "Governance Optimization",

    distributedDebugging: false,

    predictiveRecovery: false,

    governanceOptimization: true
  },

  {
    name:
      "Idle Experiment",

    distributedDebugging: false,

    predictiveRecovery: false,

    governanceOptimization: false
  }
];

for(
  const experiment
  of experiments
) {

  console.log(

    "\nEXPERIMENT:",

    experiment.name
  );

  console.log(

    JSON.stringify(

      runExperiment(
        experiment
      ),

      null,

      2
    )
  );
}
