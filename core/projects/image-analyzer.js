require("dotenv").config();

const fs = require("fs-extra");
const path = require("path");
const { spawn } = require("child_process");
const { getRABForDesa } = require("./rab-reader");
const { loadProgress, saveProgress } = require("./progress-manager");

const UPLOADS_DIR = "/root/ai-system/workspace/uploads";

// Gunakan claude CLI stream-json (mendukung vision/gambar)
async function callClaudeVision(base64Image, mimeType, systemPrompt, userPrompt) {
  return new Promise((resolve) => {
    const payload = JSON.stringify({
      type: "user",
      message: {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mimeType, data: base64Image } },
          { type: "text", text: systemPrompt + "\n\n" + userPrompt }
        ]
      }
    });

    const child = spawn("claude", [
      "-p",
      "--output-format", "stream-json",
      "--input-format", "stream-json",
      "--verbose"
    ], { env: process.env, stdio: ["pipe", "pipe", "pipe"] });

    let stdout = "";
    let settled = false;
    const done = (r) => { if (!settled) { settled = true; resolve(r); } };

    child.stdout.on("data", d => { stdout += d.toString(); });
    child.stderr.on("data", d => {}); // suppress stderr noise
    child.on("close", code => {
      // Parse stream-json — cari baris dengan type "result"
      const lines = stdout.split("\n").filter(l => l.trim());
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          if (parsed.type === "result" && parsed.result) {
            done(parsed.result);
            return;
          }
          // Fallback: baris assistant message
          if (parsed.type === "assistant") {
            const content = parsed.message?.content;
            if (Array.isArray(content)) {
              const text = content.find(c => c.type === "text")?.text;
              if (text) { done(text); return; }
            }
          }
        } catch {}
      }
      console.error("[IMG-ANALYZER] claude exit:", code, "no result found");
      done(null);
    });
    child.on("error", err => { console.error("[IMG-ANALYZER] spawn error:", err.message); done(null); });

    const timer = setTimeout(() => { child.kill("SIGTERM"); done(null); }, 120000);
    child.on("close", () => clearTimeout(timer));

    child.stdin.write(payload, "utf8");
    child.stdin.end();
  });
}

function formatRABForPrompt(rab) {
  if (!rab || !rab.items) return "RAB tidak tersedia";
  // Hanya item dengan bobot > 0, sorted by bobot desc, max 25 item
  const items = rab.items
    .filter(i => !i.is_kategori && (i.bobot || 0) > 0)
    .sort((a, b) => (b.bobot || 0) - (a.bobot || 0))
    .slice(0, 25);
  const lines = items.map(item =>
    `- ${item.uraian_sub || item.uraian}: Bobot ${(item.bobot||0).toFixed(2)}%, Jumlah Rp${(item.jumlah||0).toLocaleString("id-ID")}`
  );
  return lines.join("\n") +
    `\nNilai Kontrak Total: Rp ${(rab.total_nilai||0).toLocaleString("id-ID")}`;
}

function formatProgressForPrompt(progress) {
  if (!progress || !progress.items || Object.keys(progress.items).length === 0) {
    return "Belum ada progress sebelumnya.";
  }
  const lines = Object.entries(progress.items)
    .slice(0, 15)
    .map(([uraian, data]) => `- ${uraian}: ${data.progress}% (update: ${data.updated_at?.split("T")[0] || "n/a"})`);
  return lines.join("\n") + `\nBobot total terealisasi: ${progress.bobot_terealisasi || 0}%`;
}

function detectMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const map = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif" };
  return map[ext] || "image/jpeg";
}

async function analyzeProgressPhoto(imagePath, desaName, projectName, caption = "", pengirim = "") {
  const rab = await getRABForDesa(projectName, desaName).catch(() => null);
  const prevProgress = await loadProgress(projectName, desaName).catch(() => null);

  const rabText = formatRABForPrompt(rab);
  const progressText = formatProgressForPrompt(prevProgress);

  const timeStr = new Date().toLocaleString("id-ID", { timeZone: "Asia/Makassar" });

  const systemPrompt = `Kamu adalah pengawas lapangan konstruksi senior berpengalaman di Indonesia.
Analisa foto progress pekerjaan konstruksi ini secara detail dan profesional.
Berikan penilaian berdasarkan kondisi visual yang terlihat di foto.
Selalu kembalikan respons dalam format JSON yang valid.`;

  const userPrompt = `Proyek: ${projectName}
Lokasi: Desa ${desaName}
Pengirim laporan: ${pengirim || "tidak diketahui"}
Caption foto: ${caption || "(tidak ada caption)"}
Waktu analisa: ${timeStr}

RAB Pekerjaan yang harus dinilai progressnya:
${rabText}

Progress sebelumnya:
${progressText}

Analisa foto ini secara visual dan kembalikan HANYA JSON berikut (tanpa teks lain, tanpa markdown):
{
  "pekerjaan_teridentifikasi": ["nama pekerjaan yang terlihat di foto"],
  "progress_per_item": {"nama item RAB persis sesuai daftar di atas": persentase_angka_0_100},
  "bobot_terealisasi": hitung_dari_sum(bobot_item * progress_item / 100),
  "nilai_terealisasi": hitung_dari_sum(jumlah_item_RAB * progress_item / 100),
  "kondisi_kualitas": "baik/cukup/kurang",
  "temuan_lapangan": ["temuan visual konkret 1", "temuan 2"],
  "rekomendasi": ["aksi spesifik 1", "aksi 2"],
  "catatan_khusus": "catatan penting jika ada"
}

PENTING: bobot_terealisasi dan nilai_terealisasi harus dihitung dari data RAB yang disertakan, bukan perkiraan.`;

  let analysisResult = null;

  try {
    const imageBuffer = await fs.readFile(imagePath);
    const imageBase64 = imageBuffer.toString("base64");
    const mimeType = detectMimeType(imagePath);

    const rawText = await callClaudeVision(imageBase64, mimeType, systemPrompt, userPrompt);
    if (rawText) {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysisResult = JSON.parse(jsonMatch[0]);
      }
    }
  } catch (err) {
    console.error(`[IMG-ANALYZER] error: ${err.message}`);
    // Fallback: analisa dari caption saja
    analysisResult = {
      pekerjaan_teridentifikasi: caption ? [caption] : ["tidak teridentifikasi"],
      progress_per_item: {},
      bobot_terealisasi: 0,
      nilai_terealisasi: 0,
      kondisi_kualitas: "belum dianalisa",
      temuan_lapangan: ["Analisa visual tidak tersedia"],
      rekomendasi: ["Pastikan foto berkualitas cukup untuk dianalisa"],
      catatan_khusus: `Analisa dari caption: ${caption || "tidak ada"}. Error: ${err.message}`
    };
  }

  // Update progress di memory
  const fotoEntry = {
    tanggal: new Date().toISOString(),
    pengirim,
    caption,
    foto_path: imagePath,
    analisa: analysisResult
  };

  await saveProgress(projectName, desaName, {
    bobot_terealisasi: analysisResult.bobot_terealisasi || prevProgress?.bobot_terealisasi || 0,
    nilai_terealisasi: analysisResult.nilai_terealisasi || prevProgress?.nilai_terealisasi || 0,
    items: analysisResult.progress_per_item || {},
    foto_entry: fotoEntry
  });

  return analysisResult;
}

function formatAnalysisForTelegram(result, desaName, projectName, pengirim) {
  const timeStr = new Date().toLocaleString("id-ID", { timeZone: "Asia/Makassar" });

  const pekerjaanList = (result.pekerjaan_teridentifikasi || [])
    .map(p => `• ${p}`).join("\n") || "• (tidak terdeteksi)";

  const progressList = Object.entries(result.progress_per_item || {})
    .slice(0, 8)
    .map(([item, pct]) => {
      const icon = pct === 100 ? "✅" : pct >= 70 ? "🔄" : pct >= 30 ? "⏳" : "⬜";
      return `${icon} ${item}: ${pct}%`;
    }).join("\n") || "• (tidak ada data)";

  const temuan = (result.temuan_lapangan || []).map(t => `• ${t}`).join("\n") || "• Tidak ada temuan";
  const rek = (result.rekomendasi || []).map(r => `• ${r}`).join("\n") || "• Tidak ada rekomendasi";

  const kondisiIcon = { "baik": "🟢", "cukup": "🟡", "kurang": "🔴" }[result.kondisi_kualitas] || "⚪";

  return (
    `📸 <b>ANALISA PROGRESS</b>\n━━━━━━━━━━━━━━━━━━━\n` +
    `📍 <b>${desaName}</b> — ${projectName}\n` +
    `👤 Laporan: ${pengirim || "tidak diketahui"}\n` +
    `📅 ${timeStr} WITA\n\n` +
    `🔍 <b>PEKERJAAN TERIDENTIFIKASI:</b>\n${pekerjaanList}\n\n` +
    `📊 <b>PROGRESS PER ITEM:</b>\n${progressList}\n\n` +
    `💰 <b>BOBOT TEREALISASI:</b>\n` +
    `Progress: ${result.bobot_terealisasi || 0}%\n` +
    `Nilai: Rp ${(result.nilai_terealisasi || 0).toLocaleString("id-ID")}\n\n` +
    `${kondisiIcon} <b>KONDISI KUALITAS:</b> ${(result.kondisi_kualitas || "belum dianalisa").toUpperCase()}\n\n` +
    `⚠️ <b>TEMUAN LAPANGAN:</b>\n${temuan}\n\n` +
    `✅ <b>REKOMENDASI:</b>\n${rek}` +
    (result.catatan_khusus ? `\n\n📌 <b>CATATAN:</b> ${result.catatan_khusus}` : "")
  );
}

module.exports = {
  analyzeProgressPhoto,
  formatAnalysisForTelegram,
  detectMimeType
};
