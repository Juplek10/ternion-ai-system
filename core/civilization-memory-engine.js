const fs =
  require("fs");

const MEMORY_FILE =
  "./memory/civilization-history.json";

function loadMemory() {

  if(
    !fs.existsSync(
      MEMORY_FILE
    )
  ) {

    return [];
  }

  return JSON.parse(

    fs.readFileSync(
      MEMORY_FILE,
      "utf8"
    )
  );
}

function saveMemory(
  memory
) {

  fs.writeFileSync(

    MEMORY_FILE,

    JSON.stringify(
      memory,
      null,
      2
    )
  );
}

function rememberEvent(
  event
) {

  const history =
    loadMemory();

  history.push({

    timestamp:
      new Date()
      .toISOString(),

    ...event
  });

  saveMemory(
    history
  );

  return {

    persistentMemory:
      true,

    stored:
      event
  };
}

function recallHistory() {

  return {

    persistentMemory:
      true,

    history:
      loadMemory()
  };
}

module.exports = {

  rememberEvent,

  recallHistory
};
