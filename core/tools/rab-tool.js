require("dotenv").config();
const askOllama = require("../providers/ollama");

async function runRAB(projectName, workItems) {
  const itemsText = workItems ? `\nItem pekerjaan:\n${workItems}` : "";

  const prompt = `Kamu adalah spesialis RAB (Rencana Anggaran Biaya) konstruksi Indonesia.

Brian meminta RAB untuk proyek: "${projectName}"${itemsText}

Buat RAB dalam format tabel dengan:
- No | Uraian Pekerjaan | Vol | Sat | Harga Satuan | Jumlah
- Kelompokkan per divisi: Pekerjaan Persiapan, Sipil, Arsitektur, MEP, dll
- Gunakan estimasi harga pasar NTT/Kupang
- Sertakan total per divisi dan grand total
- Tambahkan PPN 11% dan total akhir

Format:
RENCANA ANGGARAN BIAYA
Proyek: [nama]
Lokasi: [estimasi lokasi di NTT]
Tahun: ${new Date().getFullYear()}

I. PEKERJAAN PERSIAPAN
No | Uraian | Vol | Sat | Harga Sat | Jumlah
[tabel]
Sub Total I: Rp [angka]

[lanjutkan per divisi]

REKAPITULASI:
Sub Total Semua Divisi: Rp [angka]
PPN 11%: Rp [angka]
TOTAL RAB: Rp [angka]

Terbilang: [teks angka]`;

  const result = await askOllama(prompt);
  return result;
}

module.exports = { runRAB };
