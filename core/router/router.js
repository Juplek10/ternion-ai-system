require("dotenv").config();

const askOllama = require("../providers/ollama");

process.env.DEFAULT_LOCAL_MODEL = "qwen2.5:3b";

async function routeTask(type, prompt) {

  switch(type) {

    case "heartbeat":
      return await askOllama(prompt);

    case "memory":
      return await askOllama(prompt);

    case "light":
      return await askOllama(prompt);

    default:
      return await askOllama(prompt);
  }
}

module.exports = routeTask;
