const {

  generateGoals

} = require(

  "./core/goal-driven-engine"
);

const result =

  generateGoals({

    totalModules: 3,

    workflows: 2,

    tests: 10,

    agents: 4,

    integrations: 2
  });

console.log(
  JSON.stringify(
    result,
    null,
    2
  )
);
