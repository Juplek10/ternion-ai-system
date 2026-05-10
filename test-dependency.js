const {

  analyzeDependencies

} = require(

  "./core/dependency-intelligence"
);

const result =

  analyzeDependencies(
    "/root/ai-system"
  );

console.log(
  JSON.stringify(
    result,
    null,
    2
  )
);
