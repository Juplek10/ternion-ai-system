const askClaude = require("../providers/claude-pipe");

const SYSTEM_CONTEXT = `Kamu adalah ANALIS KOMODITAS & PASAR NTT (Nusa Tenggara Timur) Indonesia.
Keahlian: harga komoditas lokal NTT (mutiara, mangan, marmer, garam, agrikultur), pasar ekspor Timor Leste,
trend harga, peluang bisnis untuk perusahaan di Kupang. Selalu berikan estimasi harga yang realistis dan analisa pasar yang tajam.`;

async function runPriceCheck(commodity) {
  const prompt = `Brian ingin tahu tentang harga: "${commodity}"

Berikan analisa harga dengan format:
KOMODITAS: [nama]
SATUAN: [kg/ton/unit/dll]

ESTIMASI HARGA PASAR NTT:
• Harga lokal NTT       : Rp [range]
• Harga ekspor Timor Leste: [USD atau Rp range]
• Harga pasar nasional  : Rp [range]

TREND TERKINI:
[analisa trend 3-6 bulan terakhir]

FAKTOR PENENTU HARGA:
• [list faktor utama]

PELUANG BISNIS TERNION GROUP:
[analisa singkat peluang konkret]

REKOMENDASI:
[saran aksi konkret untuk Brian — apa yang harus dilakukan SEKARANG]`;

  return await askClaude(prompt, { systemContext: SYSTEM_CONTEXT });
}

module.exports = { runPriceCheck };
