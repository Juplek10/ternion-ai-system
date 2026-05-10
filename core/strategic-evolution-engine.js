const fs =
  require("fs");

const file =

  "/root/ai-system/strategic-evolution-goals.json";

function loadGoals() {

  return JSON.parse(

    fs.readFileSync(
      file,
      "utf8"
    )
  );
}

function chooseEvolutionPriority() {

  const data =
    loadGoals();

  const ranked = [];

  for(
    const goal
    of data.goals
  ) {

    const score =

      (
        goal.importance *
        goal.urgency
      ) /

      goal.complexity;

    ranked.push({

      ...goal,

      score:
        score.toFixed(2)
    });
  }

  ranked.sort(

    (
      a,
      b
    ) =>

      b.score -
      a.score
  );

  return {

    nextEvolution:
      ranked[0],

    roadmap:
      ranked
  };
}

module.exports = {
  chooseEvolutionPriority
};
