function adaptCivilization(
  simulation
) {

  const actions = [];

  if(
    simulation
    .operationsStability < 5
  ) {

    actions.push({

      action:
        "Increase Operations Budget",

      reason:
        "Low operations stability"
    });
  }

  if(
    simulation
    .governanceStrength < 5
  ) {

    actions.push({

      action:
        "Strengthen Governance Organization",

      reason:
        "Weak governance detected"
    });
  }

  if(
    simulation
    .researchGrowth > 9
  ) {

    actions.push({

      action:
        "Limit Research Expansion",

      reason:
        "Research dominance risk"
    });
  }

  if(
    actions.length === 0
  ) {

    actions.push({

      action:
        "Maintain Current Civilization",

      reason:
        "Civilization stable"
    });
  }

  return {

    adapted: true,

    actions
  };
}

module.exports = {
  adaptCivilization
};
