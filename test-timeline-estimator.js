const {

  execute

} = require(

  "./core/timeline-estimator.js"
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
