const {

  safeRefactor

} = require(

  "./core/safe-refactor-engine"
);

const result =

  safeRefactor({

    filePath:
      "./core/strategic-engine.js",

    search:
      "risks",

    replace:
      "projectRisks"
  });

console.log(
  JSON.stringify(
    result,
    null,
    2
  )
);
