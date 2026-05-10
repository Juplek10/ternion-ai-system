const fsTools =
  require("./fs-tools");

const {
  createSpreadsheet
} = require("./integrations/sheets");

const {
  createFolder
} = require("./integrations/drive");

async function executeTool(
  toolName,
  params
) {

  switch(toolName) {

    case "writeFile":

      return await fsTools.writeFile(
        params.path,
        params.content
      );

    case "readFile":

      return await fsTools.readFile(
        params.path
      );

    case "createFolder":

      return await fsTools.createFolder(
        params.path
      );

    case "listFiles":

      return await fsTools.listFiles(
        params.path
      );

    case "createSpreadsheet":

      return await createSpreadsheet(
        params.title
      );

    case "createDriveFolder":

      return await createFolder(
        params.name
      );

    default:

      throw new Error(
        "Unknown tool"
      );
  }
}

module.exports =
  executeTool;
