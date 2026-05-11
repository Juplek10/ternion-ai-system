require("dotenv").config();

const askClaude = require("../providers/claude-pipe");

async function routeTask(type, prompt, options = {}) {
  return await askClaude(prompt, options);
}

module.exports = routeTask;
module.exports.classifyTask = () => "claude";
