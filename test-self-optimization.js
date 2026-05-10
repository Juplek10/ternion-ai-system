const {

  optimizeSystem

} = require(

  "./core/self-optimization-engine"
);

const result =

  optimizeSystem(
    "/root/ai-system"
  );

console.log(
  JSON.stringify(
    result,
    null,
    2
  )
);
