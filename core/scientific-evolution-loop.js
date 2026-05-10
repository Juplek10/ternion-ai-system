function scientificEvolution(
  experiments
) {

  const decisions = [];

  for(
    const experiment
    of experiments
  ) {

    if(
      experiment.success
    ) {

      decisions.push({

        experiment:
          experiment.name,

        decision:
          "Promote Innovation",

        reason:
          "Experiment successful"
      });

    } else {

      decisions.push({

        experiment:
          experiment.name,

        decision:
          "Rollback Evolution",

        reason:
          "Experiment failed"
      });
    }
  }

  return {

    scientificEvolution:
      true,

    decisions
  };
}

module.exports = {
  scientificEvolution
};
