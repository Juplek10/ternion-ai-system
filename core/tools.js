const fs = require("fs-extra");

const TOOL_FILE =
  "/root/ai-system/tools/registry.json";

async function registerTool(tool) {

  let tools = [];

  try {

    tools =
      await fs.readJson(
        TOOL_FILE
      );

  } catch(err) {

    tools = [];
  }

  tools.push({
    id: Date.now(),
    createdAt:
      new Date().toISOString(),
    ...tool
  });

  await fs.writeJson(
    TOOL_FILE,
    tools,
    { spaces: 2 }
  );

  return true;
}

async function getTools() {

  try {

    return await fs.readJson(
      TOOL_FILE
    );

  } catch(err) {

    return [];
  }
}

module.exports = {
  registerTool,
  getTools
};
