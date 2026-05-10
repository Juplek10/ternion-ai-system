const {

  executiveDecision

} = require(

  "./core/executive-cognition-engine"
);

const result =

  executiveDecision();

console.log(
  JSON.stringify(
    result,
    null,
    2
  )
);
