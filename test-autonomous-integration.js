const {

  planFeature

} = require(

  "./core/feature-planner"
);

const {

  integrateFeature

} = require(

  "./core/autonomous-integration-engine"
);

const plan =

  planFeature(

    "Tambah vendor risk timeline system"
  );

const result =

  integrateFeature(
    plan
  );

console.log(
  JSON.stringify(
    result,
    null,
    2
  )
);
