require("dotenv").config();

const askOllama = require("../providers/ollama");
const askClaude = require("../providers/claude-pipe");

const HEAVY_MODEL = "ternion-ai";
const LIGHT_MODEL = "qwen2.5:3b";

const HEAVY_TYPES = ["heavy", "ahs", "rab", "konstruksi", "strategi", "analisa", "trading", "procurement"];

function classifyTask(type) {
  return HEAVY_TYPES.includes(type) ? HEAVY_MODEL : LIGHT_MODEL;
}

async function routeTask(type, prompt) {
  const primaryAI = process.env.PRIMARY_AI || "ollama";

  // /ahs, /rab, /konstruksi selalu pakai Ollama 7b (structured output)
  if (HEAVY_TYPES.includes(type)) {
    return await askOllama(prompt, HEAVY_MODEL);
  }

  // Heartbeat dan memory selalu pakai Ollama light (cepat)
  if (type === "heartbeat" || type === "memory") {
    return await askOllama(prompt, LIGHT_MODEL);
  }

  // Chat umum: gunakan PRIMARY_AI dari .env
  if (primaryAI === "claude") {
    try {
      return await askClaude(prompt);
    } catch (err) {
      console.error("[ROUTER] Claude gagal, fallback ke qwen2.5:3b:", err.message);
      return await askOllama(prompt, LIGHT_MODEL);
    }
  }

  // Default: ollama light
  return await askOllama(prompt, LIGHT_MODEL);
}

module.exports = routeTask;
module.exports.classifyTask = classifyTask;
