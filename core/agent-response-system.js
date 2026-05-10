const {

  getMessages,

  sendMessage

} = require(

  "./agent-network"
);

function processAgent(
  agentName
) {

  const inbox =

    getMessages(
      agentName
    );

  const responses = [];

  for(
    const message
    of inbox
  ) {

    let response =
      null;

    if(
      agentName ===
      "risk-agent"
    ) {

      response =
        "Risiko utama: fluktuasi harga baja";
    }

    if(
      agentName ===
      "timeline-agent"
    ) {

      response =
        "Estimasi timeline proyek: 120 hari";
    }

    if(
      agentName ===
      "vendor-agent"
    ) {

      response =
        "Vendor disarankan: PT Beton Maju";
    }

    if(response) {

      const reply =

        sendMessage({

          from:
            agentName,

          to:
            message.from,

          type:
            "response",

          content:
            response
        });

      responses.push(
        reply
      );
    }
  }

  return responses;
}

module.exports = {
  processAgent
};
