const {

  evolveToolchain

} = require(

  "./core/autonomous-toolchain-engine"
);

const result =

  evolveToolchain({

    agentName:
      "security-agent",

    workflowName:
      "security-monitoring"
  });

console.log(

  JSON.stringify(

    result,

    null,

    2
  )
);
