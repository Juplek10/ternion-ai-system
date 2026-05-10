const {
  runAutoImprovement
} = require(
  "./core/auto-improvement-loop"
);

const result =
  runAutoImprovement();

console.log(
  JSON.stringify(
    result,
    null,
    2
  )
);
