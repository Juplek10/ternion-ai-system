

const {
  run
} = require(
  "./core/vendor-risk-engine"
);

console.log(
  JSON.stringify(
    run(),
    null,
    2
  )
);

