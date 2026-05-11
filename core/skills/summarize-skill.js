const askClaude = require("../providers/claude-pipe");

async function summarize(text) {
  const prompt = `Rangkum teks berikut dalam Bahasa Indonesia secara singkat dan padat.
Fokus pada poin-poin utama yang paling penting untuk Brian Kinayom dari TERNION GROUP.

Format output:
RINGKASAN
• [poin 1]
• [poin 2]
• [dst — maksimal 5 poin]

Poin Penting: [1-2 kalimat kesimpulan]

TEKS:
${text.substring(0, 3000)}`;

  return await askClaude(prompt);
}

module.exports = { summarize };
