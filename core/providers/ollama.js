require("dotenv").config();

const axios = require("axios");
const { getSoul } = require("../identity/soul-guardian");

async function askOllama(prompt, model = "qwen2.5:3b") {
  const systemPrompt = getSoul();

  const fullPrompt = `SYSTEM:\n\n${systemPrompt}\n\nUSER:\n\n${prompt}\n\nASSISTANT:\n`;

  const response = await axios.post(
    `${process.env.OLLAMA_BASE_URL}/api/generate`,
    {
      model: model,
      prompt: fullPrompt,
      stream: false,
      options: {
        num_ctx: 2048,
        num_predict: 250
      }
    },
    { timeout: 150000 }
  );

  return response.data.response;
}

module.exports = askOllama;
