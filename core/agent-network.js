const network = [];

function sendMessage({

  from,

  to,

  type,

  content
}) {

  const message = {

    id:
      Date.now(),

    from,

    to,

    type,

    content,

    createdAt:
      new Date()
        .toISOString()
  };

  network.push(
    message
  );

  return message;
}

function getMessages(
  agent
) {

  return network.filter(

    msg =>

      msg.to === agent
  );
}

function broadcast({

  from,

  type,

  content,

  agents
}) {

  const results = [];

  for(
    const agent
    of agents
  ) {

    results.push(

      sendMessage({

        from,

        to: agent,

        type,

        content
      })
    );
  }

  return results;
}

module.exports = {

  sendMessage,

  getMessages,

  broadcast
};
