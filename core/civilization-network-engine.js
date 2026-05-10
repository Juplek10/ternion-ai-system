function coordinateFederation(
  federation
) {

  const actions = [];

  for(
    const civilization
    of federation.civilizations
  ) {

    if(
      civilization.overloaded
    ) {

      actions.push({

        civilization:
          civilization.name,

        action:
          "Migrate Federation Workload",

        reason:
          "Civilization overload"
      });
    }

    if(
      civilization.conflict
    ) {

      actions.push({

        civilization:
          civilization.name,

        action:
          "Initiate Diplomacy Coordination",

        reason:
          "Civilization conflict detected"
      });
    }

    if(
      civilization.latency > 100
    ) {

      actions.push({

        civilization:
          civilization.name,

        action:
          "Rebalance Federation Governance",

        reason:
          "High federation latency"
      });
    }
  }

  if(
    actions.length === 0
  ) {

    actions.push({

      action:
        "Maintain Federation Stability",

      reason:
        "Federation stable"
    });
  }

  return {

    civilizationFederation:
      true,

    actions
  };
}

module.exports = {
  coordinateFederation
};
