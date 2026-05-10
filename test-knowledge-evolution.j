const {

  evolveKnowledge

} = require(

  "./core/knowledge-evolution-loop"
);

const result =

  evolveKnowledge();

console.log(
  JSON.stringify(
    result,
    null,
    2
  )
);
