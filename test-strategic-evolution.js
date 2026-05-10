
const {

  chooseEvolutionPriority

} = require(

  "./core/strategic-evolution-engine"
);

const result =

  chooseEvolutionPriority();

console.log(

  JSON.stringify(

    result,

    null,

    2
  )
);
