function learnStrategically(
  history
) {

  const doctrines = [];

  let recoveryFailures = 0;
  let debuggingSuccesses = 0;
  let overloadEvents = 0;

  for(
    const event
    of history
  ) {

    if(
      event.type ===
      "RecoveryFailure"
    ) {

      recoveryFailures++;
    }

    if(
      event.type ===
      "DebuggingSuccess"
    ) {

      debuggingSuccesses++;
    }

    if(
      event.type ===
      "InfrastructureOverload"
    ) {

      overloadEvents++;
    }
  }

  if(
    recoveryFailures >= 3
  ) {

    doctrines.push({

      doctrine:
        "Reduce Recovery Strategy Priority",

      reason:
        "Repeated recovery failures detected"
    });
  }

  if(
    debuggingSuccesses >= 3
  ) {

    doctrines.push({

      doctrine:
        "Standardize Distributed Debugging",

      reason:
        "Consistent debugging success"
    });
  }

  if(
    overloadEvents >= 3
  ) {

    doctrines.push({

      doctrine:
        "Redesign Long-Term Scaling Architecture",

      reason:
        "Repeated infrastructure overload"
    });
  }

  if(
    doctrines.length === 0
  ) {

    doctrines.push({

      doctrine:
        "Maintain Current Strategic Doctrine",

      reason:
        "No major strategic adaptation required"
    });
  }

  return {

    strategicLearning:
      true,

    doctrines
  };
}

module.exports = {
  learnStrategically
};
