const {

  planFeature

} = require(

  "./core/feature-planner"
);

const {

  generateFeature

} = require(

  "./core/autonomous-feature-generator"
);

const plan =

  planFeature(

    "Tambah vendor risk timeline system"
  );

const result =

  generateFeature(
    plan
  );

console.log(
  JSON.stringify(
    result,
    null,
    2
  )
);
