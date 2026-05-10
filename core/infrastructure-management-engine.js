function manageInfrastructure(
  infrastructure
) {

  const actions = [];

  if(
    infrastructure
    .serverLoad > 80
  ) {

    actions.push({

      action:
        "Spawn Additional Runtime Node",

      reason:
        "High server load"
    });
  }

  if(
    infrastructure
    .latency > 100
  ) {

    actions.push({

      action:
        "Redistribute Workloads",

      reason:
        "High latency detected"
    });
  }

  if(
    infrastructure
    .memoryInstability
  ) {

    actions.push({

      action:
        "Migrate Runtime Process",

      reason:
        "Memory instability detected"
    });
  }

  if(
    actions.length === 0
  ) {

    actions.push({

      action:
        "Maintain Infrastructure Stability",

      reason:
        "Infrastructure stable"
    });
  }

  return {

    infrastructureManagement:
      true,

    actions
  };
}

module.exports = {
  manageInfrastructure
};
