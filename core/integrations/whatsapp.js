require("dotenv").config();

const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");
const qrcode = require("qrcode");
const qrcodeTerminal = require("qrcode-terminal");
const fs = require("fs-extra");
const path = require("path");
const axios = require("axios");

const askClaude = require("../providers/claude-pipe");

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || "8615852356:AAGzjiONLbkuSKBvXePPwhuKACkCZMC0QaY";
const BRIAN_CHAT_ID = 6935073123;
const UPLOADS_DIR = "/root/ai-system/workspace/uploads";
const SESSION_DIR = "/root/ai-system/.wwebjs_auth";

// ─── Kirim pesan teks ke Telegram Brian ──────────────────
async function notifyTelegram(text) {
  try {
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: BRIAN_CHAT_ID,
      text,
      parse_mode: "HTML"
    });
  } catch (err) {
    console.error("[WA→TG] Gagal kirim pesan:", err.message);
  }
}

// ─── Kirim gambar QR ke Telegram Brian ───────────────────
async function sendQRToTelegram(qrString) {
  try {
    const qrBuffer = await qrcode.toBuffer(qrString, {
      type: "png",
      width: 400,
      margin: 2,
      color: { dark: "#000000", light: "#ffffff" }
    });
    const FormData = require("form-data");
    const form = new FormData();
    form.append("chat_id", BRIAN_CHAT_ID);
    form.append("photo", qrBuffer, { filename: "whatsapp-qr.png", contentType: "image/png" });
    form.append("caption", "📱 *Scan QR ini untuk menghubungkan WhatsApp ke TERNION-AI*\n\nBuka WhatsApp → Perangkat Tertaut → Tautkan Perangkat → Scan QR ini");

    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendPhoto`, form, {
      headers: form.getHeaders()
    });
    console.log("[WA] QR dikirim ke Telegram Brian");
  } catch (err) {
    console.error("[WA] Gagal kirim QR ke Telegram:", err.message);
    // Fallback: tampilkan di terminal
    qrcodeTerminal.generate(qrString, { small: true });
  }
}

// ─── Inisialisasi WhatsApp client ────────────────────────
const client = new Client({
  authStrategy: new LocalAuth({ dataPath: SESSION_DIR }),
  puppeteer: {
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--no-first-run",
      "--no-zygote",
      "--single-process",
      "--disable-gpu"
    ]
  },
  webVersionCache: {
    type: "remote",
    remotePath: "https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.3000.1023346-alpha/index.html"
  }
});

// ─── Event: QR Code ──────────────────────────────────────
client.on("qr", async (qr) => {
  console.log("[WA] QR code diterima, mengirim ke Telegram...");
  await sendQRToTelegram(qr);
  await notifyTelegram("⏳ Scan QR di atas untuk menghubungkan WhatsApp ke TERNION-AI.\n\nQR berlaku beberapa menit. Jika kadaluarsa, QR baru akan dikirim otomatis.");
});

// ─── Event: Ready ────────────────────────────────────────
client.on("ready", async () => {
  console.log("[WA] WhatsApp terhubung!");
  await notifyTelegram("✅ <b>WhatsApp terhubung ke TERNION-AI!</b>\n\nSekarang kamu bisa chat dengan AI via WhatsApp. Semua command tersedia:\n/ahs /rab /draft /harga /cari\n/konstruksi /trading /procurement\n/analisa /rangkum /terjemah");
});

// ─── Event: Authenticated ────────────────────────────────
client.on("authenticated", () => {
  console.log("[WA] Authenticated - session tersimpan");
});

// ─── Event: Auth failure ─────────────────────────────────
client.on("auth_failure", async (msg) => {
  console.error("[WA] Auth gagal:", msg);
  await notifyTelegram("❌ WhatsApp auth gagal. Restart proses untuk scan ulang.");
});

// ─── Event: Disconnected ─────────────────────────────────
client.on("disconnected", async (reason) => {
  console.error("[WA] Disconnected:", reason);
  await notifyTelegram(`⚠️ WhatsApp terputus: ${reason}\n\nSedang reconnect...`);
});

// ─── Route command sama seperti Telegram ─────────────────
async function routeCommand(cmd, query, msg) {
  const cmdLower = cmd.toLowerCase();

  try {
    if (cmdLower === "/ahs") {
      if (!query) return "Format: /ahs [deskripsi pekerjaan]";
      const { runAHS } = require("../tools/ahs-tool");
      return await runAHS(query);
    }
    if (cmdLower === "/rab") {
      if (!query) return "Format: /rab [nama proyek]";
      const { runRAB } = require("../tools/rab-tool");
      return await runRAB(query);
    }
    if (cmdLower === "/draft") {
      if (!query) return "Format: /draft [jenis dokumen + detail]";
      const { runDraft } = require("../tools/draft-tool");
      return await runDraft(query);
    }
    if (cmdLower === "/harga") {
      if (!query) return "Format: /harga [nama komoditas]";
      const { runPriceCheck } = require("../tools/price-check-tool");
      let webCtx = "";
      try {
        const { searchWeb } = require("../tools/web-search-tool");
        webCtx = await searchWeb(`harga ${query} terbaru 2026`);
      } catch {}
      return await runPriceCheck(query + (webCtx ? `\n\nData web terbaru:\n${webCtx}` : ""));
    }
    if (cmdLower === "/cari" || cmdLower === "/berita") {
      if (!query) return "Format: /cari [topik]";
      const { searchWeb } = require("../tools/web-search-tool");
      return await searchWeb(query);
    }
    if (cmdLower === "/konstruksi") {
      if (!query) return "Format: /konstruksi [pertanyaan teknis]";
      const { runConstructionAgent } = require("../agents/construction-agent");
      return await runConstructionAgent(query);
    }
    if (cmdLower === "/trading") {
      if (!query) return "Format: /trading [topik komoditas/ekspor]";
      const { runTradingAgent } = require("../agents/trading-agent");
      return await runTradingAgent(query);
    }
    if (cmdLower === "/procurement") {
      if (!query) return "Format: /procurement [pertanyaan tender/pengadaan]";
      const { runProcurementAgent } = require("../agents/procurement-agent");
      return await runProcurementAgent(query);
    }
    if (cmdLower === "/strategi") {
      if (!query) return "Format: /strategi [situasi bisnis]";
      const { runStrategyAgent } = require("../agents/strategy-agent");
      return await runStrategyAgent(query);
    }
    if (cmdLower === "/admin") {
      if (!query) return "Format: /admin [kebutuhan dokumen/administrasi]";
      const { runAdminAgent } = require("../agents/admin-agent");
      return await runAdminAgent(query);
    }
    if (cmdLower === "/analisa") {
      if (!query) return "Format: /analisa [data atau situasi]";
      const { analyze } = require("../skills/analyze-skill");
      return await analyze(query);
    }
    if (cmdLower === "/rangkum") {
      if (!query) return "Format: /rangkum [teks]";
      const { summarize } = require("../skills/summarize-skill");
      return await summarize(query);
    }
    if (cmdLower === "/terjemah") {
      const parts = query.split(/\s+/);
      const lang = parts[0] || "";
      const content = parts.slice(1).join(" ");
      if (!lang || !content) return "Format: /terjemah [bahasa] [teks]";
      const { translate } = require("../skills/translate-skill");
      return await translate(lang, content);
    }
    if (cmdLower === "/help") {
      return "📋 *Command TERNION-AI via WhatsApp:*\n\n*Tools:*\n/ahs - Analisa Harga Satuan\n/rab - Rencana Anggaran Biaya\n/draft - Buat dokumen\n/harga - Cek harga komoditas\n/cari - Web search\n\n*Agents:*\n/konstruksi - Teknis konstruksi\n/trading - Komoditas & ekspor\n/procurement - Tender & pengadaan\n/strategi - Analisa bisnis\n/admin - Dokumen administrasi\n\n*Skills:*\n/analisa - Analisa data\n/rangkum - Rangkum teks\n/terjemah - Terjemahkan\n\nAtau kirim pesan biasa untuk chat dengan AI!";
    }

    // Dynamic skills
    const skillCmd = cmdLower.replace("/", "");
    const { runDynamicSkill } = require("../evolution/skill-builder");
    const skillResult = await runDynamicSkill(skillCmd, query);
    if (skillResult !== null) return skillResult;

    return null; // tidak dikenali sebagai command
  } catch (err) {
    console.error(`[WA] Error routing command ${cmd}:`, err.message);
    return `❌ Error: ${err.message}`;
  }
}

// ─── Upload file ke Google Drive ─────────────────────────
async function uploadToDrive(localPath, filename) {
  try {
    const { uploadFile } = require("./drive-backup");
    await uploadFile(localPath, "UPLOADS");
    return true;
  } catch (err) {
    console.error("[WA] Drive upload gagal:", err.message);
    return false;
  }
}

// ─── Handler pesan masuk ─────────────────────────────────
client.on("message", async (msg) => {
  // Abaikan pesan dari status / broadcast
  if (msg.from === "status@broadcast") return;
  if (msg.isStatus) return;

  const sender = msg.from;
  const contact = await msg.getContact().catch(() => null);
  const senderName = contact?.pushname || contact?.name || sender.replace("@c.us", "");
  const body = msg.body || "";

  console.log(`[WA] Pesan dari ${senderName} (${sender}): ${body.substring(0, 80)}`);

  // ── Handler file/media ────────────────────────────────
  if (msg.hasMedia) {
    try {
      await msg.react("⏳");
      const media = await msg.downloadMedia();
      if (!media) {
        await msg.reply("❌ Gagal mengunduh file.");
        return;
      }
      await fs.ensureDir(UPLOADS_DIR);
      const ext = media.mimetype.split("/")[1]?.split(";")[0] || "bin";
      const filename = `wa_${Date.now()}_${senderName.replace(/\s+/g, "_")}.${ext}`;
      const localPath = path.join(UPLOADS_DIR, filename);
      await fs.writeFile(localPath, Buffer.from(media.data, "base64"));

      const uploaded = await uploadToDrive(localPath, filename);
      const driveStatus = uploaded ? "✅ Tersimpan di Google Drive (UPLOADS/)" : "⚠️ Disimpan lokal (Drive gagal)";

      await msg.reply(`📁 *File diterima!*\n\n📌 Nama: ${filename}\n💾 Lokal: workspace/uploads/\n☁️ ${driveStatus}`);
      await msg.react("✅");
    } catch (err) {
      console.error("[WA] Error handle media:", err.message);
      await msg.reply("❌ Gagal memproses file: " + err.message).catch(() => {});
    }
    return;
  }

  // ── Handler teks ──────────────────────────────────────
  if (!body.trim()) return;

  try {
    // Cek apakah command
    if (body.startsWith("/")) {
      const parts = body.trim().split(/\s+/);
      const cmd = parts[0].toLowerCase();
      const query = parts.slice(1).join(" ");

      await msg.react("⏳");
      const result = await routeCommand(cmd, query, msg);
      if (result !== null) {
        await msg.reply(result);
        await msg.react("✅");
        return;
      }
    }

    // Chat biasa — route ke Claude dengan context WhatsApp
    await msg.react("⏳");
    const prompt = `[Pesan dari WhatsApp]\nPengirim: ${senderName} (${sender})\n\n${body}`;
    const reply = await askClaude(prompt, {
      systemContext: "Pesan ini diterima via WhatsApp. Balas ringkas dan natural."
    });
    await msg.reply(reply);
    await msg.react("✅");

    // Simpan ke memory
    try {
      const { saveConversation } = require("../memory/long-term-memory");
      await saveConversation(`[WhatsApp dari ${senderName}] ${body}`, reply).catch(() => {});
    } catch {}

  } catch (err) {
    console.error("[WA] Error handle pesan:", err.message);
    await msg.reply("Maaf, coba kirim ulang.").catch(() => {});
    await msg.react("❌").catch(() => {});
  }
});

// ─── Start client ─────────────────────────────────────────
async function start() {
  console.log("[WA] Starting WhatsApp client...");
  try {
    await client.initialize();
  } catch (err) {
    console.error("[WA] Initialize error:", err.message);
    await notifyTelegram(`❌ WhatsApp gagal start: ${err.message}`);
    process.exit(1);
  }
}

module.exports = { start, client, notifyTelegram };
