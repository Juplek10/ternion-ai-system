const {

  simulateCivilization

} = require(

  "./core/civilization-simulation-engine"
);

const result =

  simulateCivilization();

console.log(

  JSON.stringify(

    result,

    null,

    2
  )
);
