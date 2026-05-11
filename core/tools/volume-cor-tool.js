const askClaude = require("../providers/claude-pipe");

const SYSTEM_CONTEXT = `Kamu adalah Ternion-AI, asisten strategis Brian Kinayom (Founder TERNION GROUP, Kupang NTT).
Tool ini khusus untuk: hitung volume pengecoran beton untuk konstruksi.
Berikan output terstruktur dengan perhitungan detail dan referensi harga NTT 2026.`;

async function runVolumeCor(input) {
  const prompt = `Hitung volume pengecoran beton untuk konstruksi.

Detail dari Bry: ${input}

Berikan hasil yang komprehensif, terstruktur, dan praktis.
Sertakan tabel, perhitungan, dan estimasi biaya yang relevan untuk proyek di Kupang NTT.`;
  return await askClaude(prompt, { systemContext: SYSTEM_CONTEXT });
}

module.exports = { runVolumeCor };
