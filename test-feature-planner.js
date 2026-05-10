const {

  planFeature

} = require(

  "./core/feature-planner"
);

const result =

  planFeature(

    "Tambah vendor risk timeline system"
  );

console.log(
  JSON.stringify(
    result,
    null,
    2
  )
);
