require("dotenv").config();
const askOllama = require("../providers/ollama");

async function runAHS(description) {
  const prompt = `Kamu adalah spesialis Analisa Harga Satuan (AHS) konstruksi Indonesia.

Brian meminta AHS untuk: "${description}"

Buat tabel AHS lengkap dengan format berikut:
- Kolom: No | Uraian | Satuan | Koefisien | Harga Satuan | Jumlah
- Kelompok: Material, Upah Tenaga Kerja, Peralatan, Overhead & Profit (10-15%)
- Gunakan harga estimasi pasar NTT/Kupang terkini
- Totalkan di akhir

Format output:
AHS: [nama pekerjaan]
Satuan: [m², m³, unit, dll]

MATERIAL:
No | Uraian | Sat | Koef | Harga/Sat | Jumlah
[isi tabel]

UPAH:
[isi tabel]

PERALATAN:
[isi tabel]

SUB TOTAL MATERIAL: Rp [angka]
SUB TOTAL UPAH: Rp [angka]
SUB TOTAL ALAT: Rp [angka]
OVERHEAD & PROFIT (12%): Rp [angka]
HARGA SATUAN TOTAL: Rp [angka]

Catatan: [referensi harga atau asumsi yang digunakan]`;

  const result = await askOllama(prompt);
  return result;
}

module.exports = { runAHS };
