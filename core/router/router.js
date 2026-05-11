require("dotenv").config();

const askOllama = require("../providers/ollama");

const HEAVY_MODEL = "ternion-ai";
const LIGHT_MODEL = "qwen2.5:3b";

const HEAVY_TYPES = ["heavy", "ahs", "rab", "konstruksi", "strategi", "analisa", "trading", "procurement"];

function classifyTask(type) {
  return HEAVY_TYPES.includes(type) ? HEAVY_MODEL : LIGHT_MODEL;
}

async function routeTask(type, prompt) {
  const model = classifyTask(type);

  switch (type) {
    case "heartbeat":
      return await askOllama(prompt, LIGHT_MODEL);
    case "memory":
      return await askOllama(prompt, LIGHT_MODEL);
    default:
      return await askOllama(prompt, model);
  }
}

module.exports = routeTask;
module.exports.classifyTask = classifyTask;
