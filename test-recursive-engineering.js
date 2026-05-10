const {

  recursiveEngineering

} = require(

  "./core/recursive-engineering-engine"
);

const result =

  recursiveEngineering({

    moduleName:
      "runtime-monitor-engine",

    capability:
      "runtime monitoring"
  });

console.log(

  JSON.stringify(

    result,

    null,

    2
  )
);
