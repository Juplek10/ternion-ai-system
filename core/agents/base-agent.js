require("dotenv").config();

const askClaude = require("../providers/claude-pipe");
const { searchMemory } = require("../memory/long-term-memory");

async function runAgent(agentSystemPrompt, userQuery) {
  // Cari konteks relevan dari memory
  const memResults = await searchMemory(userQuery).catch(() => []);
  const memContext = memResults.length > 0
    ? `\nKONTEKS DARI MEMORY BRIAN:\n${memResults.map(r => `- [${r.category}] ${r.text}`).join("\n")}`
    : "";

  const prompt = `${memContext}\n\nPERTANYAAN BRIAN:\n${userQuery}`;

  return await askClaude(prompt, { systemContext: agentSystemPrompt });
}

module.exports = { runAgent };
