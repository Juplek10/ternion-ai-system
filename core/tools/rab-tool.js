const askClaude = require("../providers/claude-pipe");

const SYSTEM_CONTEXT = `Kamu adalah QUANTITY SURVEYOR SENIOR Indonesia, spesialis RAB (Rencana Anggaran Biaya) konstruksi.
Keahlian: BOQ detail, harga satuan NTT, rekapitulasi RAB, PPN, terbilang.
Selalu buat RAB lengkap per divisi pekerjaan. Gunakan harga pasar NTT/Kupang terkini.`;

async function runRAB(projectName, workItems) {
  const itemsText = workItems ? `\nItem pekerjaan detail:\n${workItems}` : "";
  const year = new Date().getFullYear();

  const prompt = `Brian meminta RAB untuk proyek: "${projectName}"${itemsText}

Buat RAB dalam format tabel dengan:
- No | Uraian Pekerjaan | Vol | Sat | Harga Satuan (Rp) | Jumlah (Rp)
- Kelompokkan per divisi: I. Persiapan, II. Sipil/Struktur, III. Arsitektur, IV. MEP (listrik/plumbing), V. Finishing
- Gunakan estimasi harga pasar NTT/Kupang ${year}
- Total per divisi dan grand total
- Tambahkan PPN 11% dan total akhir
- Terbilang dalam huruf

Format:
RENCANA ANGGARAN BIAYA
Proyek  : ${projectName}
Lokasi  : Kupang, NTT
Tahun   : ${year}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

I. PEKERJAAN PERSIAPAN
No | Uraian | Vol | Sat | Harga Sat | Jumlah
[tabel]
Sub Total I: Rp [angka]

[lanjutkan divisi II, III, IV, V]

REKAPITULASI:
Sub Total Semua Divisi : Rp [angka]
PPN 11%               : Rp [angka]
TOTAL RAB             : Rp [angka]

Terbilang: [teks angka]`;

  return await askClaude(prompt, { systemContext: SYSTEM_CONTEXT });
}

module.exports = { runRAB };
