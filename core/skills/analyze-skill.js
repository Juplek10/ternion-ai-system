require("dotenv").config();
const askOllama = require("../providers/ollama");

async function analyze(data) {
  const prompt = `Kamu adalah analis strategis untuk Brian Kinayom dari TERNION GROUP, Kupang NTT.

Analisa data/situasi berikut secara tajam dan praktis:

${data.substring(0, 2000)}

Buat analisa dengan format:
📊 ANALISA SITUASI

🔍 Fakta Utama:
• [poin 1]
• [poin 2]

⚡ Peluang:
• [peluang 1]
• [peluang 2]

⚠️ Risiko:
• [risiko 1]
• [risiko 2]

🎯 Rekomendasi Tindakan:
1. [langkah 1 — konkret dan bisa dilakukan sekarang]
2. [langkah 2]
3. [langkah 3]

💬 Kesimpulan: [1-2 kalimat bottom line untuk Brian]`;

  return await askOllama(prompt, "ternion-ai");
}

module.exports = { analyze };
