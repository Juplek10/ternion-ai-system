const {

  addGoal,

  completeGoal,

  getRoadmap

} = require(

  "./core/strategic-memory-engine"
);

addGoal(
  "Expand vendor intelligence",
  "high"
);

addGoal(
  "Improve autonomous planning",
  "medium"
);

completeGoal(
  "Expand vendor intelligence"
);

console.log(

  JSON.stringify(

    getRoadmap(),

    null,

    2
  )
);
