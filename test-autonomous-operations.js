const {

  autonomousOperations

} = require(

  "./core/autonomous-operations-engine"
);

const result =

  autonomousOperations();

console.log(
  JSON.stringify(
    result,
    null,
    2
  )
);
