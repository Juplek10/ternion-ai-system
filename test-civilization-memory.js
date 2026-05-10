const {

  rememberEvent,

  recallHistory

} = require(

  "./core/civilization-memory-engine"
);

rememberEvent({

  type:
    "Experiment",

  event:
    "Distributed debugging successful"
});

rememberEvent({

  type:
    "Recovery",

  event:
    "Runtime recovery stabilized federation"
});

console.log(

  JSON.stringify(

    recallHistory(),

    null,

    2
  )
);
