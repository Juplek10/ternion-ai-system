const {

  scientificEvolution

} = require(

  "./core/scientific-evolution-loop"
);

const experiments = [

  {
    name:
      "Distributed Debugging",

    success: true
  },

  {
    name:
      "Predictive Recovery",

    success: true
  },

  {
    name:
      "Experimental Governance",

    success: false
  }
];

console.log(

  JSON.stringify(

    scientificEvolution(
      experiments
    ),

    null,

    2
  )
);
