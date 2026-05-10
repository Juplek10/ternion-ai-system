function generateGoals(
  systemState
) {

  const goals = [];

  if(
    systemState.totalModules <
    20
  ) {

    goals.push({

      priority: "high",

      goal:
        "Expand module ecosystem"
    });
  }

  if(
    systemState.workflows <
    5
  ) {

    goals.push({

      priority: "high",

      goal:
        "Create additional workflows"
    });
  }

  if(
    systemState.tests <
    20
  ) {

    goals.push({

      priority: "medium",

      goal:
        "Increase validation coverage"
    });
  }

  if(
    systemState.agents <
    10
  ) {

    goals.push({

      priority: "medium",

      goal:
        "Expand agent collaboration"
    });
  }

  if(
    systemState.integrations <
    5
  ) {

    goals.push({

      priority: "low",

      goal:
        "Add external integrations"
    });
  }

  return goals;
}

module.exports = {
  generateGoals
};
