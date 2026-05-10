require("dotenv").config();
const askOllama = require("../providers/ollama");

async function runPriceCheck(commodity) {
  const prompt = `Kamu adalah analis komoditas dan pasar NTT (Nusa Tenggara Timur) Indonesia.

Brian ingin tahu tentang harga: "${commodity}"

Berikan analisa harga dengan format:
KOMODITAS: [nama]
SATUAN: [kg/ton/unit/dll]

ESTIMASI HARGA PASAR NTT:
- Harga lokal NTT: Rp [range]
- Harga ekspor ke Timor Leste: [USD atau Rp range]
- Harga pasar nasional: Rp [range]

TREND TERKINI:
[analisa trend 3-6 bulan terakhir]

FAKTOR PENENTU HARGA:
- [list faktor]

PELUANG BISNIS:
[analisa singkat peluang untuk TERNION GROUP]

REKOMENDASI:
[saran konkret untuk Brian]

Catatan: Gunakan pengetahuan terbaik kamu tentang pasar NTT dan komoditas lokal.`;

  const result = await askOllama(prompt);
  return result;
}

module.exports = { runPriceCheck };
