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

// ─── Nomor pribadi owner untuk notifikasi & konfirmasi ───
const OWNER_WA = "6282266130808@c.us";

// ─── Antrian pesan menunggu konfirmasi owner ─────────────
// Map<id, { msg, sender, senderName, body, proposedReply, timer }>
const pendingApprovals = new Map();
const APPROVAL_TIMEOUT_MS = 10 * 60 * 1000; // 10 menit

// ─── Generate ID pendek (4 karakter) ─────────────────────
function genId() {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}

// ─── Format waktu lokal ──────────────────────────────────
function timeNow() {
  return new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Makassar" });
}

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
    qrcodeTerminal.generate(qrString, { small: true });
  }
}

// ─── Kirim notifikasi ke nomor pribadi owner ─────────────
async function notifyOwner(text) {
  try {
    await client.sendMessage(OWNER_WA, text);
    console.log("[WA] Notifikasi terkirim ke owner");
  } catch (err) {
    console.error("[WA] Gagal notif ke owner:", err.message);
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
  webVersion: "2.3000.1015901785-alpha",
  webVersionCache: {
    type: "remote",
    remotePath: "https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.3000.1015901785-alpha/index.html"
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
  try {
    const chats = await client.getChats();
    console.log(`[WA] Koneksi OK — ${chats.length} chat ditemukan`);
  } catch (err) {
    console.error("[WA] getChats gagal:", err.message);
  }
  await notifyTelegram("✅ <b>WhatsApp terhubung ke TERNION-AI!</b>\n\nSistem aktif 24/7. Pesan dari kontak baru akan dikonfirmasi ke owner sebelum dibalas.");
  await notifyOwner("✅ *TERNION-AI WhatsApp Aktif*\n\nSistem siap menerima pesan. Setiap pesan dari kontak lain akan dikirim ke sini untuk dikonfirmasi sebelum dibalas.");
});

// ─── Event: Authenticated ────────────────────────────────
client.on("authenticated", () => {
  console.log("[WA] Authenticated - session tersimpan");
});

// ─── Event: State change ─────────────────────────────────
client.on("change_state", (state) => {
  console.log("[WA] State:", state);
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
  // PM2 akan auto-restart, tidak perlu manual reconnect
});

// ─── Cek apakah pertanyaan identitas ─────────────────────
function isIdentityQuestion(body) {
  const lower = body.toLowerCase();
  return (
    lower.includes("siapa anda") ||
    lower.includes("siapa kamu") ||
    lower.includes("kamu siapa") ||
    lower.includes("anda siapa") ||
    lower.includes("who are you") ||
    lower.includes("who r u") ||
    lower.includes("lo siapa") ||
    lower.includes("kamu ini siapa") ||
    lower.includes("ini siapa")
  );
}

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
      return "📋 *Command TERNION-AI via WhatsApp:*\n\n*Tools:*\n/ahs - Analisa Harga Satuan\n/rab - Rencana Anggaran Biaya\n/draft - Buat dokumen\n/harga - Cek harga komoditas\n/cari - Web search\n\n*Agents:*\n/konstruksi - Teknis konstruksi\n/trading - Komoditas & ekspor\n/procurement - Tender & pengadaan\n/strategi - Analisa bisnis\n/admin - Dokumen administrasi\n\n*Skills:*\n/analisa - Analisa data\n/rangkum - Rangkum teks\n/terjemah - Terjemahkan\n\nAtau kirim pesan biasa untuk chat!";
    }

    const skillCmd = cmdLower.replace("/", "");
    const { runDynamicSkill } = require("../evolution/skill-builder");
    const skillResult = await runDynamicSkill(skillCmd, query);
    if (skillResult !== null) return skillResult;

    return null;
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

// ─── Helper: react fire-and-forget ───────────────────────
function react(msg, emoji) {
  msg.react(emoji).catch(() => {});
}

// ─── Handler pesan dari OWNER (konfirmasi / arahan) ──────
async function handleOwnerMessage(msg) {
  const body = (msg.body || "").trim();
  console.log(`[WA] Pesan dari Owner: ${body.substring(0, 80)}`);

  // Cek pola: KIRIM #ID atau SKIP #ID atau [teks] #ID
  const idMatch = body.match(/#([A-Z0-9]{4})\s*$/i);

  if (idMatch) {
    const id = idMatch[1].toUpperCase();
    const pending = pendingApprovals.get(id);

    if (!pending) {
      await notifyOwner(`⚠️ Tidak ada pesan dengan ID *#${id}* (mungkin sudah expired atau tidak valid).`);
      return;
    }

    // Bersihkan timer timeout
    clearTimeout(pending.timer);
    pendingApprovals.delete(id);

    const cmdPart = body.replace(/#[A-Z0-9]{4}\s*$/i, "").trim().toUpperCase();

    if (cmdPart === "SKIP") {
      // Owner pilih tidak balas
      console.log(`[WA] Owner SKIP pesan #${id}`);
      await notifyOwner(`🚫 Pesan *#${id}* dari ${pending.senderName} diabaikan.`);
      react(pending.msg, "🚫");
      return;
    }

    // Tentukan teks yang akan dikirim
    const replyText = (cmdPart === "" || cmdPart === "KIRIM")
      ? pending.proposedReply           // kirim balasan AI
      : body.replace(/#[A-Z0-9]{4}\s*$/i, "").trim(); // kirim teks custom owner

    try {
      await pending.msg.reply(replyText);
      react(pending.msg, "✅");
      console.log(`[WA] Balasan #${id} terkirim ke ${pending.sender}`);
      await notifyOwner(`✅ Balasan *#${id}* terkirim ke *${pending.senderName}*:\n\n"${replyText.substring(0, 200)}"`);

      // Simpan ke memory
      try {
        const { saveConversation } = require("../memory/long-term-memory");
        await saveConversation(`[WhatsApp dari ${pending.senderName}] ${pending.body}`, replyText).catch(() => {});
      } catch {}
    } catch (err) {
      console.error("[WA] Gagal kirim balasan:", err.message);
      await notifyOwner(`❌ Gagal kirim balasan #${id}: ${err.message}`);
    }
    return;
  }

  // Tidak ada #ID → ini arahan/instruksi umum dari owner, konfirmasi terima
  console.log(`[WA] Arahan dari owner: ${body}`);
  await notifyOwner(`✅ Arahan diterima: "${body.substring(0, 100)}"\n\nAkan diterapkan pada balasan selanjutnya.`);

  // Simpan arahan sebagai context tambahan untuk AI
  try {
    const { saveConversation } = require("../memory/long-term-memory");
    await saveConversation(`[Arahan Owner via WA] ${body}`, "Arahan dicatat.").catch(() => {});
  } catch {}
}

// ─── Handler pesan masuk dari kontak lain ────────────────
async function handleIncomingMessage(msg) {
  const sender = msg.from;
  const body = msg.body || "";
  const contact = await msg.getContact().catch(() => null);
  const senderName = contact?.pushname || contact?.name || sender.replace("@c.us", "");

  console.log(`[WA] Pesan masuk dari ${senderName} (${sender}): ${body.substring(0, 80)}`);

  // ── Handler file/media ────────────────────────────────
  if (msg.hasMedia) {
    react(msg, "⏳");
    try {
      const media = await msg.downloadMedia();
      if (!media) {
        await notifyOwner(`📎 *File diterima dari ${senderName}* tapi gagal diunduh.`);
        return;
      }
      await fs.ensureDir(UPLOADS_DIR);
      const ext = media.mimetype.split("/")[1]?.split(";")[0] || "bin";
      const filename = `wa_${Date.now()}_${senderName.replace(/\s+/g, "_")}.${ext}`;
      const localPath = path.join(UPLOADS_DIR, filename);
      await fs.writeFile(localPath, Buffer.from(media.data, "base64"));

      const uploaded = await uploadToDrive(localPath, filename);
      const driveStatus = uploaded ? "✅ Tersimpan di Google Drive" : "⚠️ Disimpan lokal saja";

      await notifyOwner(`📎 *File dari ${senderName}*\nNama: ${filename}\n${driveStatus}`);
      react(msg, "✅");
    } catch (err) {
      console.error("[WA] Error handle media:", err.message);
      await notifyOwner(`❌ Error handle file dari ${senderName}: ${err.message}`);
    }
    return;
  }

  if (!body.trim()) return;

  react(msg, "⏳");

  // ── Pertanyaan identitas: jawab langsung ─────────────
  if (isIdentityQuestion(body)) {
    const identityReply = "Saya admin Ternion Group. Ada yang bisa saya bantu?";
    const id = genId();

    // Tetap notif ke owner
    await notifyOwner(
      `📨 *Pesan Masuk #${id}*\n` +
      `Dari: *${senderName}* (${sender.replace("@c.us", "")})\n` +
      `Waktu: ${timeNow()}\n\n` +
      `💬 "${body}"\n\n` +
      `🤖 Rencana balasan (identitas):\n"${identityReply}"\n\n` +
      `━━━━━━━━━━━━\n` +
      `• *KIRIM #${id}* — Kirim balasan ini\n` +
      `• *SKIP #${id}* — Abaikan\n` +
      `• *[teks] #${id}* — Kirim teks custom\n` +
      `⏰ Expired dalam 10 menit`
    );

    const timer = setTimeout(async () => {
      if (pendingApprovals.has(id)) {
        pendingApprovals.delete(id);
        console.log(`[WA] Pesan #${id} expired tanpa konfirmasi`);
        await notifyOwner(`⏰ Pesan *#${id}* dari ${senderName} expired tanpa respons.`);
        react(msg, "❌");
      }
    }, APPROVAL_TIMEOUT_MS);

    pendingApprovals.set(id, { msg, sender, senderName, body, proposedReply: identityReply, timer });
    return;
  }

  // ── Command khusus (/ahs, /rab, dst) ─────────────────
  if (body.startsWith("/")) {
    const parts = body.trim().split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const query = parts.slice(1).join(" ");

    const result = await routeCommand(cmd, query, msg).catch(() => null);
    if (result !== null) {
      const id = genId();
      await notifyOwner(
        `📨 *Pesan Masuk #${id}* (Command)\n` +
        `Dari: *${senderName}* (${sender.replace("@c.us", "")})\n` +
        `Waktu: ${timeNow()}\n\n` +
        `💬 "${body}"\n\n` +
        `🤖 Rencana balasan:\n"${(result || "").substring(0, 300)}"\n\n` +
        `━━━━━━━━━━━━\n` +
        `• *KIRIM #${id}* — Kirim balasan ini\n` +
        `• *SKIP #${id}* — Abaikan\n` +
        `• *[teks] #${id}* — Kirim teks custom\n` +
        `⏰ Expired dalam 10 menit`
      );

      const timer = setTimeout(async () => {
        if (pendingApprovals.has(id)) {
          pendingApprovals.delete(id);
          await notifyOwner(`⏰ Pesan *#${id}* dari ${senderName} expired.`);
          react(msg, "❌");
        }
      }, APPROVAL_TIMEOUT_MS);

      pendingApprovals.set(id, { msg, sender, senderName, body, proposedReply: result, timer });
      return;
    }
  }

  // ── Chat biasa → generate AI reply → minta konfirmasi ─
  try {
    const prompt = `[Pesan WhatsApp dari ${senderName}]\n\n${body}`;
    const aiReply = await askClaude(prompt, {
      systemContext: "Kamu adalah admin Ternion Group. Balas ringkas, profesional, dan natural. Jangan sebut nama AI atau bot."
    });

    const id = genId();

    await notifyOwner(
      `📨 *Pesan Masuk #${id}*\n` +
      `Dari: *${senderName}* (${sender.replace("@c.us", "")})\n` +
      `Waktu: ${timeNow()}\n\n` +
      `💬 "${body}"\n\n` +
      `🤖 Rencana balasan:\n"${aiReply.substring(0, 500)}"\n\n` +
      `━━━━━━━━━━━━\n` +
      `• *KIRIM #${id}* — Kirim balasan ini\n` +
      `• *SKIP #${id}* — Abaikan\n` +
      `• *[teks] #${id}* — Kirim teks custom\n` +
      `⏰ Expired dalam 10 menit`
    );

    const timer = setTimeout(async () => {
      if (pendingApprovals.has(id)) {
        pendingApprovals.delete(id);
        console.log(`[WA] Pesan #${id} expired`);
        await notifyOwner(`⏰ Pesan *#${id}* dari *${senderName}* expired tanpa respons.`);
        react(msg, "❌");
      }
    }, APPROVAL_TIMEOUT_MS);

    pendingApprovals.set(id, { msg, sender, senderName, body, proposedReply: aiReply, timer });
    console.log(`[WA] Pesan #${id} dari ${senderName} menunggu konfirmasi owner`);

  } catch (err) {
    console.error("[WA] Error generate reply:", err.message);
    react(msg, "❌");
    await notifyOwner(`❌ Gagal generate balasan untuk pesan dari ${senderName}: ${err.message}`);
  }
}

// ─── Handler utama semua pesan ────────────────────────────
async function handleMessage(msg) {
  if (msg.from === "status@broadcast") return;
  if (msg.isStatus) return;
  console.log(`[WA] Event: from=${msg.from} fromMe=${msg.fromMe} type=${msg.type} body="${(msg.body||"").substring(0,50)}"`);
  if (msg.fromMe) return;

  const sender = msg.from;

  // Pesan dari owner → proses sebagai konfirmasi/arahan
  if (sender === OWNER_WA) {
    await handleOwnerMessage(msg);
    return;
  }

  // Pesan dari kontak lain → proses & minta konfirmasi
  await handleIncomingMessage(msg);
}

client.on("message", handleMessage);
client.on("message_create", handleMessage);

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
