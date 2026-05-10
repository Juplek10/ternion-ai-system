const {

  sendMessage,

  getMessages,

  broadcast

} = require(

  "./core/agent-network"
);

sendMessage({

  from:
    "planner-agent",

  to:
    "risk-agent",

  type:
    "risk-analysis",

  content:
    "Analisa risiko proyek gudang baja"
});

broadcast({

  from:
    "planner-agent",

  type:
    "objective",

  content:
    "Bangun strategi proyek gudang",

  agents: [

    "vendor-agent",

    "timeline-agent",

    "estimator-agent"
  ]
});

console.log(

  "\nRISK AGENT MESSAGES\n"
);

console.log(

  JSON.stringify(

    getMessages(
      "risk-agent"
    ),

    null,
    2
  )
);

console.log(

  "\nTIMELINE AGENT MESSAGES\n"
);

console.log(

  JSON.stringify(

    getMessages(
      "timeline-agent"
    ),

    null,
    2
  )
);
