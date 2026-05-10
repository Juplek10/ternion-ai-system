require("dotenv").config();

const axios = require("axios");
const fs = require("fs");

const systemPrompt = fs.readFileSync(
  "/root/ai-system/prompts/ternion-soul.txt",
  "utf8"
);

async function askOllama(prompt) {

  const fullPrompt = `
SYSTEM:

${systemPrompt}

USER:

${prompt}

ASSISTANT:
`;

  const response = await axios.post(
    `${process.env.OLLAMA_BASE_URL}/api/generate`,
    {
      model: process.env.DEFAULT_LOCAL_MODEL,
      prompt: fullPrompt,
      stream: false,
      options: {
        num_ctx: 2048,
        num_predict: 500
      }
    },
    { timeout: 120000 }
  );

  return response.data.response;
}

module.exports = askOllama;
