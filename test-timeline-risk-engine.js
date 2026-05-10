

const {
  run
} = require(
  "./core/timeline-risk-engine"
);

console.log(
  JSON.stringify(
    run(),
    null,
    2
  )
);

