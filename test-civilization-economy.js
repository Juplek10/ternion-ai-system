const {

  analyzeEconomy

} = require(

  "./core/civilization-economy-engine"
);

const result =

  analyzeEconomy();

console.log(

  JSON.stringify(

    result,

    null,

    2
  )
);

