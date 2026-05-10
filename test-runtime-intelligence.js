const {

  getRuntimeHealth

} = require(

  "./core/runtime-intelligence"
);

const result =

  getRuntimeHealth();

console.log(
  JSON.stringify(
    result,
    null,
    2
  )
);
