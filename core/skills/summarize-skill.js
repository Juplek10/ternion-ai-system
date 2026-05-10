require("dotenv").config();
const askOllama = require("../providers/ollama");

async function summarize(text) {
  const prompt = `Rangkum teks berikut dalam Bahasa Indonesia secara singkat dan padat.
Fokus pada poin-poin utama yang paling penting untuk Brian Kinayom dari TERNION GROUP.

Format:
📋 RINGKASAN
• [poin 1]
• [poin 2]
• [dst]

💡 Poin Penting: [1-2 kalimat kesimpulan]

TEKS:
${text.substring(0, 2000)}`;

  return await askOllama(prompt);
}

module.exports = { summarize };
