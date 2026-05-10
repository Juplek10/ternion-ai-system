require("dotenv").config();

const fs = require("fs");

const {
  google,
  oauth2Client
} = require("./google");

oauth2Client.setCredentials(
  JSON.parse(
    fs.readFileSync(
      "/root/ai-system/tokens/google-token.json"
    )
  )
);

const sheets = google.sheets({
  version: "v4",
  auth: oauth2Client
});

async function getSpreadsheet(spreadsheetId) {

  const res =
    await sheets.spreadsheets.get({
      spreadsheetId
    });

  return res.data;
}

async function createSpreadsheet(title) {

  const resource = {
    properties: {
      title
    }
  };

  const response =
    await sheets.spreadsheets.create({
      resource
    });

  return response.data;
}

module.exports = {
  sheets,
  getSpreadsheet,
  createSpreadsheet
};
