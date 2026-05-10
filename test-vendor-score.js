const {

  execute

} = require(

  "./core/vendor-score-engine.js"
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
