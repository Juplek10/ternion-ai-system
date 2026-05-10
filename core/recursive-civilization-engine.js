function redesignCivilization(
  civilization
) {

  const redesigns = [];

  if(
    civilization
    .governanceModel ===
    "centralized"
  ) {

    redesigns.push({

      redesign:
        "Distributed Governance Civilization",

      reason:
        "Reduce governance bottleneck"
    });
  }

  if(
    civilization
    .operationsLoad > 8
  ) {

    redesigns.push({

      redesign:
        "Split Operations Organization",

      reason:
        "High operational overload"
    });
  }

  if(
    civilization
    .researchDominance > 8
  ) {

    redesigns.push({

      redesign:
        "Balanced Research Ecosystem",

      reason:
        "Prevent civilization imbalance"
    });
  }

  if(
    redesigns.length === 0
  ) {

    redesigns.push({

      redesign:
        "Maintain Current Civilization Model",

      reason:
        "Civilization optimized"
    });
  }

  return {

    recursiveEvolution:
      true,

    redesigns
  };
}

module.exports = {
  redesignCivilization
};

