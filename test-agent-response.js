const {

  sendMessage,

  getMessages

} = require(

  "./core/agent-network"
);

const {

  processAgent

} = require(

  "./core/agent-response-system"
);

sendMessage({

  from:
    "planner-agent",

  to:
    "risk-agent",

  type:
    "risk-analysis",

  content:
    "Analisa proyek gudang"
});

sendMessage({

  from:
    "planner-agent",

  to:
    "timeline-agent",

  type:
    "timeline",

  content:
    "Hitung timeline proyek"
});

sendMessage({

  from:
    "planner-agent",

  to:
    "vendor-agent",

  type:
    "vendor",

  content:
    "Cari vendor terbaik"
});

processAgent(
  "risk-agent"
);

processAgent(
  "timeline-agent"
);

processAgent(
  "vendor-agent"
);

console.log(

  "\nPLANNER INBOX\n"
);

console.log(

  JSON.stringify(

    getMessages(
      "planner-agent"
    ),

    null,
    2
  )
);
