require("dotenv").config();

const axios = require("axios");
const { getSoul } = require("../identity/soul-guardian");
const { searchMemory } = require("../memory/long-term-memory");

async function runAgent(agentSystemPrompt, userQuery, model = "ternion-ai") {
  // Cari konteks relevan dari memory
  const memResults = await searchMemory(userQuery).catch(() => []);
  const memContext = memResults.length > 0
    ? `\nKONTEKS DARI MEMORY:\n${memResults.map(r => `- [${r.category}] ${r.text}`).join("\n")}\n`
    : "";

  const baseSoul = getSoul();

  const fullPrompt = `SISTEM:\n${baseSoul}\n\nPERAN KHUSUS:\n${agentSystemPrompt}${memContext}\n\nUSER:\n${userQuery}\n\nASSISTANT:\n`;

  const response = await axios.post(
    `${process.env.OLLAMA_BASE_URL}/api/generate`,
    {
      model: model,
      prompt: fullPrompt,
      stream: false,
      options: { num_ctx: 2048, num_predict: 400 }
    },
    { timeout: 180000 }
  );

  return response.data.response;
}

module.exports = { runAgent };
