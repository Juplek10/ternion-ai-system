function generateObjectives(
  civilization
) {

  const objectives = [];

  if(
    civilization
    .limitedDistributedCognition
  ) {

    objectives.push({

      objective:
        "Global Cognition Expansion",

      mission:
        "Expand distributed intelligence ecosystem"
    });
  }

  if(
    civilization
    .slowDebuggingRecovery
  ) {

    objectives.push({

      objective:
        "Predictive Autonomous Debugging",

      mission:
        "Accelerate recursive debugging intelligence"
    });
  }

  if(
    civilization
    .researchStagnation
  ) {

    objectives.push({

      objective:
        "Continuous Experimentation Civilization",

      mission:
        "Expand scientific experimentation operations"
    });
  }

  if(
    civilization
    .weakFederationCoordination
  ) {

    objectives.push({

      objective:
        "Adaptive Federation Coordination",

      mission:
        "Strengthen distributed civilization orchestration"
    });
  }

  if(
    objectives.length === 0
  ) {

    objectives.push({

      objective:
        "Maintain Current Civilization Objectives",

      mission:
        "Civilization ecosystem stable"
    });
  }

  return {

    autonomousObjectiveGeneration:
      true,

    objectives
  };
}

module.exports = {
  generateObjectives
};
