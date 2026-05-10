const {

  execute

} = require(

  "./core/risk-analysis-engine.js"
);

const result =

  execute({

    test: true
  });

console.log(
  JSON.stringify(
    result,
    null,
    2
  )
);
