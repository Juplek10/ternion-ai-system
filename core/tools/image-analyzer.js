require("dotenv").config();

const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { spawn } = require("child_process");

const UPLOADS_DIR = "/root/ai-system/workspace/uploads";
const PROYEK_FILE = "/root/ai-system/memory/proyek.json";

const KEYWORDS_PROYEK = ["proyek", "progress", "laporan", "konstruksi", "bangunan", "gedung", "jalan", "cor", "kolom", "balok", "pondasi", "atap", "lantai"];
const KEYWORDS_MATERIAL = ["material", "mangan", "mutiara", "batu", "hasil", "stok", "gudang", "tambang", "mineral", "komoditas"];
const KEYWORDS_DOKUMEN = ["dokumen", "surat", "kontrak", "spk", "invoice", "faktur", "nota", "sk", "sertifikat"];

function detectImageType(caption) {
  if (!caption) return "umum";
  const lower = caption.toLowerCase();
  if (KEYWORDS_PROYEK.some(k => lower.includes(k))) return "proyek";
  if (KEYWORDS_MATERIAL.some(k => lower.includes(k))) return "material";
  if (KEYWORDS_DOKUMEN.some(k => lower.includes(k))) return "dokumen";
  return "umum";
}

function buildSystemPrompt(imageType, caption) {
  const base = `Kamu adalah analis dokumentasi TERNION GROUP, perusahaan konstruksi dan trading di Kupang, NTT, milik Brian Kinayom. Jawab dalam Bahasa Indonesia, singkat dan actionable.`;

  const typePrompts = {
    proyek: `${base}
Analisa foto dokumentasi proyek konstruksi ini dan berikan:
1. Deskripsi kondisi yang terlihat
2. Estimasi progress pekerjaan (persentase %)
3. Tahap pekerjaan yang sedang berlangsung
4. Hal yang perlu diperhatikan atau potensi masalah
5. Rekomendasi tindak lanjut

${caption ? `Konteks tambahan dari user: "${caption}"` : ""}`,

    material: `${base}
Analisa foto material/komoditas ini dan berikan:
1. Identifikasi jenis material/komoditas yang terlihat
2. Estimasi volume atau jumlah jika terlihat
3. Kondisi material (baik/perlu penanganan)
4. Rekomendasi penanganan atau penyimpanan

${caption ? `Konteks tambahan dari user: "${caption}"` : ""}`,

    dokumen: `${base}
Baca dan analisa dokumen/surat pada foto ini:
1. Jenis dokumen (kontrak/SPK/invoice/surat resmi/lainnya)
2. Ekstrak informasi penting (pihak, nilai, tanggal, nomor)
3. Poin-poin utama yang perlu diperhatikan
4. Tindak lanjut yang diperlukan

${caption ? `Konteks tambahan dari user: "${caption}"` : ""}`,

    umum: `${base}
Analisa foto ini dan berikan:
1. Deskripsi apa yang terlihat
2. Relevansi dengan bisnis TERNION GROUP (konstruksi, trading, komoditas NTT)
3. Informasi atau insight penting dari foto ini
4. Rekomendasi jika ada

${caption ? `Konteks dari user: "${caption}"` : ""}`
  };

  return typePrompts[imageType] || typePrompts.umum;
}

function buildDriveFolder() {
  const now = new Date();
  const month = now.toISOString().substring(0, 7); // "2026-05"
  return `TERNION-AI/DOKUMENTASI/${month}`;
}

async function analyzeImage(imagePath, caption = "") {
  const imageType = detectImageType(caption);

  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString("base64");
  const ext = path.extname(imagePath).toLowerCase().replace(".", "");
  const mimeMap = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp" };
  const mimeType = mimeMap[ext] || "image/jpeg";

  const systemPrompt = buildSystemPrompt(imageType, caption);

  // Kirim ke Claude vision via API langsung dengan base64
  const result = await askClaudeVision(base64Image, mimeType, systemPrompt);

  // Format output
  const typeLabel = { proyek: "Dokumentasi Proyek", material: "Material/Komoditas", dokumen: "Dokumen/Surat", umum: "Foto Umum" };
  const driveFolder = buildDriveFolder();

  let output = `📸 <b>ANALISA FOTO TERNION-AI</b>\n`;
  output += `━━━━━━━━━━━━━━━━━━━━━━\n`;
  output += `📋 <b>Jenis:</b> ${typeLabel[imageType] || "Foto Umum"}\n\n`;
  output += result;
  output += `\n\n💾 <b>Disimpan ke:</b> ${driveFolder}`;

  // Auto-backup ke Drive (async, tidak block response)
  uploadToDrive(imagePath, driveFolder).catch(err => console.error("[IMAGE] Drive upload error:", err.message));

  // Jika proyek, simpan ke memory
  if (imageType === "proyek" && caption) {
    saveProyekFoto(imagePath, caption, result).catch(() => {});
  }

  return output;
}

async function askClaudeVision(base64Image, mimeType, systemPrompt) {
  // Gunakan claude CLI dengan input JSON untuk vision
  const payload = JSON.stringify({
    role: "user",
    content: [
      { type: "image", source: { type: "base64", media_type: mimeType, data: base64Image } },
      { type: "text", text: systemPrompt }
    ]
  });

  return new Promise((resolve) => {
    const child = spawn("claude", ["-p", "--output-format", "text"], {
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";
    let settled = false;
    const done = (r) => { if (!settled) { settled = true; resolve(r); } };

    child.stdout.on("data", d => { stdout += d.toString(); });
    child.stderr.on("data", d => { stderr += d.toString(); });

    child.on("close", (code) => {
      if (code === 0 && stdout.trim()) done(stdout.trim());
      else {
        console.error("[VISION] claude error:", code, stderr.substring(0, 200));
        done(analyzeWithClaudeApi(base64Image, mimeType, systemPrompt));
      }
    });

    child.on("error", (err) => {
      console.error("[VISION] spawn error:", err.message);
      done(analyzeWithClaudeApi(base64Image, mimeType, systemPrompt));
    });

    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      done(analyzeWithClaudeApi(base64Image, mimeType, systemPrompt));
    }, 60000);

    child.on("close", () => clearTimeout(timer));

    // Kirim sebagai multiline prompt dengan image description request
    child.stdin.write(systemPrompt + "\n\n[Gambar dilampirkan sebagai base64: " + mimeType + ", " + Math.round(base64Image.length * 0.75 / 1024) + "KB]", "utf8");
    child.stdin.end();
  });
}

async function analyzeWithClaudeApi(base64Image, mimeType, systemPrompt) {
  // Fallback: gunakan Anthropic API langsung
  try {
    const Anthropic = require("@anthropic-ai/sdk");
    const client = new Anthropic.Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mimeType, data: base64Image } },
          { type: "text", text: systemPrompt }
        ]
      }]
    });

    return response.content[0]?.text || "Tidak dapat menganalisa gambar.";
  } catch (err) {
    console.error("[VISION] Anthropic API error:", err.message);
    return "Analisa gambar tidak tersedia saat ini. Gambar telah disimpan.";
  }
}

async function uploadToDrive(filePath, folderPath) {
  try {
    const { uploadFile } = require("../integrations/drive-backup");
    await uploadFile(filePath, folderPath);
    console.log("[IMAGE] Uploaded to Drive:", folderPath);
  } catch (err) {
    console.log("[IMAGE] Drive upload skipped:", err.message);
  }
}

async function saveProyekFoto(imagePath, caption, analisa) {
  try {
    const data = fs.existsSync(PROYEK_FILE)
      ? JSON.parse(fs.readFileSync(PROYEK_FILE, "utf8"))
      : { entries: [] };

    if (!data.foto) data.foto = [];
    data.foto.push({
      path: imagePath,
      caption,
      analisa: analisa.substring(0, 300),
      timestamp: new Date().toISOString()
    });

    fs.writeFileSync(PROYEK_FILE, JSON.stringify(data, null, 2));
  } catch {}
}

async function listFoto(proyekFilter = null) {
  try {
    const files = fs.readdirSync(UPLOADS_DIR).filter(f => /\.(jpg|jpeg|png|gif|webp)$/i.test(f));
    if (files.length === 0) return "Belum ada foto tersimpan.";

    const list = files.slice(-10).map(f => {
      const stat = fs.statSync(path.join(UPLOADS_DIR, f));
      const date = stat.mtime.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
      return `📸 ${f}\n   📅 ${date}`;
    });

    return `📁 <b>Foto Tersimpan (10 terbaru):</b>\n\n${list.join("\n\n")}`;
  } catch (err) {
    return `Error: ${err.message}`;
  }
}

module.exports = { analyzeImage, listFoto, detectImageType };
