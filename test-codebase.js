const {

  analyzeCodebase

} = require(

  "./core/codebase-intelligence"
);

const result =

  analyzeCodebase(
    "/root/ai-system"
  );

console.log(
  JSON.stringify(
    result,
    null,
    2
  )
);
