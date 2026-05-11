const askClaude = require("../providers/claude-pipe");

const SYSTEM_CONTEXT = `Kamu adalah SPESIALIS DOKUMEN BISNIS & ADMINISTRASI PROFESIONAL Indonesia.
Keahlian: surat resmi, kontrak, proposal, notulen, berita acara, laporan — semua sesuai standar Indonesia.
Selalu buat dokumen lengkap dan siap pakai dengan kop surat TERNION GROUP.`;

const JENIS_DOKUMEN = [
  "surat penawaran",
  "surat perjanjian",
  "proposal bisnis",
  "laporan proyek",
  "nota dinas",
  "surat permohonan",
  "berita acara",
  "kontrak kerja"
];

async function runDraft(request) {
  const lowerReq = request.toLowerCase();
  let jenis = "surat resmi";
  for (const j of JENIS_DOKUMEN) {
    if (lowerReq.includes(j)) { jenis = j; break; }
  }

  const today = new Date().toLocaleDateString("id-ID", {
    day: "numeric", month: "long", year: "numeric"
  });

  const prompt = `Brian meminta draft dokumen: "${request}"

Buat draft "${jenis}" yang:
- Lengkap dan siap pakai (dari kop sampai tanda tangan)
- Kop surat: TERNION GROUP | Jl. [alamat Kupang] | Kupang, NTT | Telp/WA: [nomor]
- Format profesional sesuai standar Indonesia
- Tanggal: ${today}
- Tanda tangan: Brian Kinayom | Direktur TERNION GROUP

Tulis dokumen lengkap sekarang:`;

  return await askClaude(prompt, { systemContext: SYSTEM_CONTEXT });
}

module.exports = { runDraft, JENIS_DOKUMEN };
