require("dotenv").config();

const fs = require("fs");
const readline = require("readline");

const {
  google,
  oauth2Client
} = require("./core/integrations/google");

const SCOPES = [
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/documents"
];

const authUrl = oauth2Client.generateAuthUrl({
  access_type: "offline",
	prompt: "consent",
  scope: SCOPES,
});

console.log("\nOPEN THIS URL:\n");
console.log(authUrl);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question("\nPASTE CODE HERE: ", async (code) => {

  const { tokens } =
    await oauth2Client.getToken(code);

  oauth2Client.setCredentials(tokens);

  fs.writeFileSync(
    "/root/ai-system/tokens/google-token.json",
    JSON.stringify(tokens, null, 2)
  );

  console.log("\nGOOGLE AUTH SUCCESS");

  rl.close();
});
