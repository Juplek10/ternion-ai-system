const {

  calculatePriority

} = require(

  "./core/autonomous-priority-engine"
);

const result =

  calculatePriority([

    {
      goal:
        "Improve autonomous planning"
    },

    {
      goal:
        "Expand workflow system"
    },

    {
      goal:
        "Refactor architecture"
    },

    {
      goal:
        "Improve memory intelligence"
    }
  ]);

console.log(
  JSON.stringify(
    result,
    null,
    2
  )
);
