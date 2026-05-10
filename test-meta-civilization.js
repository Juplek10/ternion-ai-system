const {

  compareCivilizations

} = require(

  "./core/meta-civilization-engine"
);

const result =

  compareCivilizations();

console.log(

  JSON.stringify(

    result,

    null,

    2
  )
);
