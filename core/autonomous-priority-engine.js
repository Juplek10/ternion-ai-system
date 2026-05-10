function calculatePriority(
  roadmap
) {

  const scored = [];

  for(
    const item
    of roadmap
  ) {

    let impact = 1;
    let effort = 1;

    const goal =

      item.goal
      .toLowerCase();

    if(
      goal.includes(
        "autonomous"
      )
    ) {

      impact += 5;
    }

    if(
      goal.includes(
        "integration"
      )
    ) {

      impact += 4;
    }

    if(
      goal.includes(
        "memory"
      )
    ) {

      impact += 3;
    }

    if(
      goal.includes(
        "workflow"
      )
    ) {

      impact += 2;
    }

    if(
      goal.includes(
        "architecture"
      )
    ) {

      effort += 5;
    }

    if(
      goal.includes(
        "refactor"
      )
    ) {

      effort += 4;
    }

    const score =
      impact / effort;

    scored.push({

      goal:
        item.goal,

      impact,

      effort,

      score
    });
  }

  return scored.sort(

    (
      a,
      b
    ) =>

      b.score -
      a.score
  );
}

module.exports = {
  calculatePriority
};
