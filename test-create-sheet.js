const {
  createSpreadsheet
} = require("./core/integrations/sheets");

async function test() {

  const result =
    await createSpreadsheet(
      "Construction AI Test"
    );

  console.log(result.spreadsheetUrl);
}

test();

