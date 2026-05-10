const {
  registerTool
} = require("./core/tools");

async function setup() {

  await registerTool({
    name: "Google Drive",
    type: "storage",
    description:
      "Create folders and manage files"
  });

  await registerTool({
    name: "Google Sheets",
    type: "spreadsheet",
    description:
      "Create and edit spreadsheets"
  });

  await registerTool({
    name: "Telegram",
    type: "communication",
    description:
      "Send messages to Telegram"
  });

  await registerTool({
    name: "Gmail",
    type: "email",
    description:
      "Send and read emails"
  });

  console.log(
    "TOOLS REGISTERED"
  );
}

setup();
