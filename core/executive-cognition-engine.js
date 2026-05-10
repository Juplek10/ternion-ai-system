const fs =
  require("fs");

const file =

  "/root/ai-system/executive-objectives.json";

function loadObjectives() {

  return JSON.parse(

    fs.readFileSync(
      file,
      "utf8"
    )
  );
}

function executiveDecision() {

  const data =
    loadObjectives();

  const scored = [];

  for(
    const objective
    of data.objectives
  ) {

    const score =

      (
        objective.priority *
        objective.impact
      ) /

      objective.effort;

    scored.push({

      ...objective,

      score:
        score.toFixed(2)
    });
  }

  scored.sort(

    (
      a,
      b
    ) =>

      b.score -
      a.score
  );

  return {

    executiveChoice:
      scored[0],

    rankedObjectives:
      scored
  };
}

module.exports = {
  executiveDecision
};
