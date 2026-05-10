const {

  generateGoals

} = require(

  "./goal-driven-engine"
);

const {

  planFeature

} = require(

  "./feature-planner"
);

const {

  generateFeature

} = require(

  "./autonomous-feature-generator"
);

const {

  integrateFeature

} = require(

  "./autonomous-integration-engine"
);

async function evolveSystem(
  systemState
) {

  const goals =

    generateGoals(
      systemState
    );

  const evolution = [];

  for(
    const item
    of goals
  ) {

    const plan =

      planFeature(
        item.goal
      );

    const generated =

      generateFeature(
        plan
      );

    const integrated =

      integrateFeature(
        plan
      );

    evolution.push({

      goal:
        item.goal,

      priority:
        item.priority,

      generated,

      integrated
    });
  }

  return {

    success: true,

    evolution
  };
}

module.exports = {
  evolveSystem
};
