function recoverRuntime(
  runtime
) {

  const actions = [];

  if(
    runtime.workerDown
  ) {

    actions.push({

      action:
        "Restart Worker",

      recovered:
        true
    });
  }

  if(
    runtime.memoryLeak
  ) {

    actions.push({

      action:
        "Restart Isolated Process",

      recovered:
        true
    });
  }

  if(
    runtime.runtimeFreeze
  ) {

    actions.push({

      action:
        "Recover Stable Runtime",

      recovered:
        true
    });
  }

  if(
    actions.length === 0
  ) {

    actions.push({

      action:
        "Maintain Runtime Stability",

      recovered:
        true
    });
  }

  return {

    autonomousRecovery:
      true,

    actions
  };
}

module.exports = {
  recoverRuntime
};
