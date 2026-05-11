const askClaude = require("../providers/claude-pipe");

const SYSTEM_CONTEXT = `Kamu adalah Ternion-AI, asisten strategis Brian Kinayom (Founder TERNION GROUP, Kupang NTT).
Skill ini khusus untuk: analisa kebutuhan besi beton untuk konstruksi berdasarkan luas dan tipe struktur.
Konteks bisnis: procurement, konstruksi, trading komoditas NTT, ekspor-impor.`;

async function runCekBesi(input) {
  const prompt = `Analisa kebutuhan besi beton untuk konstruksi berdasarkan luas dan tipe struktur.

Input dari Bry: ${input}

Berikan analisa yang detail, praktis, dan spesifik untuk konteks NTT/Kupang.
Sertakan estimasi biaya jika relevan.`;
  return await askClaude(prompt, { systemContext: SYSTEM_CONTEXT });
}

module.exports = { runCekBesi };
