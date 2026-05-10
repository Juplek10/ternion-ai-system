require("dotenv").config();
const askOllama = require("../providers/ollama");

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
    if (lowerReq.includes(j)) {
      jenis = j;
      break;
    }
  }

  const today = new Date().toLocaleDateString("id-ID", {
    day: "numeric", month: "long", year: "numeric"
  });

  const prompt = `Kamu adalah spesialis dokumen bisnis dan administrasi profesional Indonesia.

Brian meminta: "${request}"

Buat draft "${jenis}" yang:
- Lengkap dan siap pakai
- Menggunakan kop surat TERNION GROUP (Kupang, NTT)
- Format profesional sesuai standar Indonesia
- Tanggal: ${today}
- Tanda tangan: Brian Kinayom, Direktur TERNION GROUP

Tulis dokumen lengkap dari kop sampai tanda tangan:`;

  const result = await askOllama(prompt);
  return result;
}

module.exports = { runDraft, JENIS_DOKUMEN };
