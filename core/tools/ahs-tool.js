const askClaude = require("../providers/claude-pipe");

const SYSTEM_CONTEXT = `Kamu adalah ESTIMATOR KONSTRUKSI SENIOR Indonesia, spesialis Analisa Harga Satuan (AHS).
Keahlian: AHS per item pekerjaan, harga material dan upah pasar NTT/Kupang, koefisien SNI, overhead dan profit konstruksi.
Selalu buat tabel lengkap dan akurat. Gunakan harga estimasi pasar NTT terkini tahun 2025-2026.`;

async function runAHS(description) {
  const today = new Date().getFullYear();
  const prompt = `Brian meminta AHS untuk: "${description}"

Buat tabel AHS lengkap dengan format berikut:
- Kolom: No | Uraian | Satuan | Koefisien | Harga Satuan (Rp) | Jumlah (Rp)
- Kelompok: Material, Upah Tenaga Kerja, Peralatan, Overhead & Profit (12%)
- Gunakan harga estimasi pasar NTT/Kupang ${today}
- Totalkan di akhir

Format output:
AHS: [nama pekerjaan]
Satuan: [m², m³, unit, dll]

MATERIAL:
No | Uraian | Sat | Koef | Harga/Sat | Jumlah
[isi tabel]

UPAH TENAGA KERJA:
No | Uraian | Sat | Koef | Harga/Sat | Jumlah
[isi tabel]

PERALATAN:
[isi tabel atau tulis "Tidak ada peralatan khusus"]

SUB TOTAL MATERIAL   : Rp [angka]
SUB TOTAL UPAH       : Rp [angka]
SUB TOTAL ALAT       : Rp [angka]
OVERHEAD & PROFIT 12%: Rp [angka]
HARGA SATUAN TOTAL   : Rp [angka]

Catatan: [referensi harga atau asumsi yang digunakan]`;

  return await askClaude(prompt, { systemContext: SYSTEM_CONTEXT });
}

module.exports = { runAHS };
