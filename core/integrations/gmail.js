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

const gmail = google.gmail({
  version: "v1",
  auth: oauth2Client
});

async function getEmails() {

  const res = await gmail.users.messages.list({
    userId: "me",
    maxResults: 5
  });

  return res.data.messages || [];
}

module.exports = {
  gmail,
  getEmails
};


