const fs = require("fs-extra");

const MEMORY_FILE =
  "/root/ai-system/memory/memory.json";

async function saveMemory(data) {

  let memories = [];

  try {

    memories = await fs.readJson(MEMORY_FILE);

  } catch(err) {

    memories = [];

  }

  memories.push({
    timestamp: new Date().toISOString(),
    data
  });

  await fs.writeJson(
    MEMORY_FILE,
    memories,
    { spaces: 2 }
  );

  return true;
}

async function getMemories() {

  try {

    return await fs.readJson(MEMORY_FILE);

  } catch(err) {

    return [];

  }
}

module.exports = {
  saveMemory,
  getMemories
};
