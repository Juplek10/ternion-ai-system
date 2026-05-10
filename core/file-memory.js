const fs =
  require("fs");

const MEMORY_PATH =

  "/root/ai-system/memory/file-memory.json";

/*
===================================
LOAD MEMORY
===================================
*/

function loadMemory() {

  try {

    return JSON.parse(

      fs.readFileSync(
        MEMORY_PATH
      )
    );

  } catch(error) {

    return [];
  }
}

/*
===================================
SAVE MEMORY
===================================
*/

function saveMemory(
  memory
) {

  fs.writeFileSync(

    MEMORY_PATH,

    JSON.stringify(
      memory,
      null,
      2
    )
  );
}

/*
===================================
ADD FILE MEMORY
===================================
*/

function addFileMemory(
  fileData
) {

  const memory =
    loadMemory();

  memory.unshift({

    ...fileData,

    timestamp:
      new Date()
      .toISOString()
  });

  saveMemory(memory);
}

/*
===================================
GET LAST FILE
===================================
*/

function getLastFile() {

  const memory =
    loadMemory();

  if(
    memory.length === 0
  ) {

    return null;
  }

  return memory[0];
}

/*
===================================
DELETE FILE MEMORY
===================================
*/

function removeFileMemory(
  filePath
) {

  const memory =
    loadMemory();

  const filtered =

    memory.filter(

      item =>

        item.path !==
        filePath
    );

  saveMemory(filtered);
}

module.exports = {

  addFileMemory,

  getLastFile,

  removeFileMemory,

  loadMemory
};
