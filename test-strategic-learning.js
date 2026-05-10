const {

  learnStrategically

} = require(

  "./core/strategic-learning-engine"
);

const history = [

  {
    type:
      "RecoveryFailure"
  },

  {
    type:
      "RecoveryFailure"
  },

  {
    type:
      "RecoveryFailure"
  },

  {
    type:
      "DebuggingSuccess"
  },

  {
    type:
      "DebuggingSuccess"
  },

  {
    type:
      "DebuggingSuccess"
  },

  {
    type:
      "InfrastructureOverload"
  },

  {
    type:
      "InfrastructureOverload"
  },

  {
    type:
      "InfrastructureOverload"
  }
];

console.log(

  JSON.stringify(

    learnStrategically(
      history
    ),

    null,

    2
  )
);
