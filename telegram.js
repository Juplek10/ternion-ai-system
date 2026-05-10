require("dotenv").config();

const { Telegraf } = require("telegraf");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

// ─── Core modules ──────────────────────────────────────
const { addFileMemory, getLastFile, removeFileMemory } = require("./core/file-memory");
const routeTask = require("./core/router/router");
const { loadSession, addMessage } = require("./core/session");
const { getSoul } = require("./core/identity/soul-guardian");
const { autoExtract, searchMemory, addFact, forgetTopic, getMemorySummary } = require("./core/memory/long-term-memory");

// ─── Tools ─────────────────────────────────────────────
const { runAHS } = require("./core/tools/ahs-tool");
const { runRAB } = require("./core/tools/rab-tool");
const { runDraft } = require("./core/tools/draft-tool");
const { runPriceCheck } = require("./core/tools/price-check-tool");

// ─── Agents ────────────────────────────────────────────
const { runProcurementAgent } = require("./core/agents/procurement-agent");
const { runTradingAgent } = require("./core/agents/trading-agent");
const { runConstructionAgent } = require("./core/agents/construction-agent");
const { runStrategyAgent } = require("./core/agents/strategy-agent");
const { runAdminAgent } = require("./core/agents/admin-agent");

// ─── Skills ────────────────────────────────────────────
const { summarize } = require("./core/skills/summarize-skill");
const { translate } = require("./core/skills/translate-skill");
const { analyze } = require("./core/skills/analyze-skill");
const { setReminder, listReminders } = require("./core/skills/reminder-skill");

const TELEGRAM_TOKEN = "8615852356:AAGzjiONLbkuSKBvXePPwhuKACkCZMC0QaY";
const AUTHORIZED_USERS = [6935073123];

let conversationCountToday = 0;

const bot = new Telegraf(TELEGRAM_TOKEN, { handlerTimeout: 180000 });

bot.handleError = async (err, ctx) => {
  console.log("BOT ERROR (handled):", err.message);
  try {
    await ctx.reply("Maaf Bry, ada kendala teknis. Kirim ulang pesan kamu.");
  } catch (e) {}
};

function isAuthorized(chatId) {
  return AUTHORIZED_USERS.includes(chatId);
}

// ─── Helper: kirim pesan panjang ───────────────────────
async function sendLong(ctx, text) {
  const chunks = [];
  for (let i = 0; i < text.length; i += 4000) {
    chunks.push(text.substring(i, i + 4000));
  }
  for (const chunk of chunks) {
    await ctx.reply(chunk);
  }
}

// ─── Helper: typing indicator ──────────────────────────
async function withTyping(ctx, fn) {
  await ctx.sendChatAction("typing");
  return await fn();
}

// ─── /start ────────────────────────────────────────────
bot.start(async (ctx) => {
  if (!isAuthorized(ctx.chat.id)) return ctx.reply("Unauthorized.");
  await ctx.reply("Ternion-AI Online, Bry!\n\nKirim /help untuk melihat semua command.");
});

// ─── /help ─────────────────────────────────────────────
bot.command("help", async (ctx) => {
  if (!isAuthorized(ctx.chat.id)) return;
  const msg =
`🤖 <b>TERNION-AI COMMAND CENTER</b>
━━━━━━━━━━━━━━━━━━━━━━━━━
👤 Halo Bry! Ini yang bisa saya lakukan:

🛠️ <b>TOOLS:</b>
/ahs → Analisa Harga Satuan
/rab → Generate RAB
/draft → Buat dokumen/surat
/harga → Cek harga komoditas

🤝 <b>AGENTS:</b>
/procurement → Tender &amp; pengadaan
/trading → Komoditas &amp; ekspor
/konstruksi → Proyek konstruksi
/strategi → Strategi bisnis
/admin → Dokumen &amp; administrasi

⚡ <b>SKILLS:</b>
/rangkum → Rangkum teks
/terjemah → Terjemahan
/analisa → Analisa data
/ingatkan → Set reminder

🧠 <b>MEMORY:</b>
/memory → Lihat memory aktif
/ingat [fakta] → Tambah fakta baru
/lupa [topik] → Hapus memory

⚙️ <b>SISTEM:</b>
/status → Status sistem
/drive → File di Drive
/help → Menu ini
━━━━━━━━━━━━━━━━━━━━━━━━━
💬 Atau kirim pesan bebas untuk ngobrol!`;

  await ctx.replyWithHTML(msg);
});

// ─── /status ───────────────────────────────────────────
bot.command("status", async (ctx) => {
  if (!isAuthorized(ctx.chat.id)) return;
  await ctx.sendChatAction("typing");

  let ram = { usedGB: "?", totalGB: "?", pct: "?" };
  try {
    const meminfo = fs.readFileSync("/proc/meminfo", "utf8");
    const total = parseInt(meminfo.match(/MemTotal:\s+(\d+)/)[1]) * 1024;
    const avail = parseInt(meminfo.match(/MemAvailable:\s+(\d+)/)[1]) * 1024;
    const used = total - avail;
    ram.pct = Math.round((used / total) * 100);
    ram.usedGB = (used / 1e9).toFixed(1);
    ram.totalGB = (total / 1e9).toFixed(1);
  } catch (e) {}

  let ollamaStatus = "❌ tidak terhubung";
  try {
    const res = await axios.get(`${process.env.OLLAMA_BASE_URL}/api/tags`, { timeout: 5000 });
    const models = res.data.models || [];
    const found = models.find(m => m.name.includes("ternion"));
    ollamaStatus = found ? "✅ ternion-ai" : "✅ online";
  } catch (e) {}

  const soul = getSoul();
  const soulStatus = soul && soul.length > 100 ? "✅ loaded" : "❌ error";
  const timeStr = new Date().toLocaleString("id-ID", { timeZone: "Asia/Makassar" });

  const msg =
`⚙️ <b>STATUS TERNION-AI</b>
─────────────────────
⏰ ${timeStr} WITA
🧠 Model: ${ollamaStatus}
💾 RAM: ${ram.usedGB} / ${ram.totalGB} GB (${ram.pct}%)
💬 Percakapan hari ini: ${conversationCountToday}
🔋 Soul: ${soulStatus}
📡 Bot: ✅ online`;

  await ctx.replyWithHTML(msg);
});

// ─── /memory ───────────────────────────────────────────
bot.command("memory", async (ctx) => {
  if (!isAuthorized(ctx.chat.id)) return;
  await ctx.sendChatAction("typing");

  const summary = await getMemorySummary();
  const msg =
`🧠 <b>MEMORY AKTIF</b>
─────────────────────
📊 Total fakta: ${summary.total_facts}
💬 Percakapan tersimpan: ${summary.total_conversations}
📚 Learnings: ${summary.total_learnings}

🎯 <b>Proyek/Deadline:</b>
${summary.active_projects}

💡 <b>Keputusan Terakhir:</b>
${summary.latest_decisions}

🔬 <b>Learning Terbaru:</b>
${summary.latest_learnings}`;

  await ctx.replyWithHTML(msg);
});

// ─── /ingat ────────────────────────────────────────────
bot.command("ingat", async (ctx) => {
  if (!isAuthorized(ctx.chat.id)) return;
  const text = ctx.message.text.replace("/ingat", "").trim();
  if (!text) return ctx.reply("Format: /ingat [fakta yang ingin disimpan]");

  await addFact("brian", text);
  await ctx.reply(`✅ Tersimpan di memory:\n"${text}"`);
});

// ─── /lupa ─────────────────────────────────────────────
bot.command("lupa", async (ctx) => {
  if (!isAuthorized(ctx.chat.id)) return;
  const topic = ctx.message.text.replace("/lupa", "").trim();
  if (!topic) return ctx.reply("Format: /lupa [topik yang ingin dihapus]");

  const deleted = await forgetTopic(topic);
  await ctx.reply(`✅ Dihapus ${deleted} item terkait "${topic}" dari memory.`);
});

// ─── /drive ────────────────────────────────────────────
bot.command("drive", async (ctx) => {
  if (!isAuthorized(ctx.chat.id)) return;
  await ctx.sendChatAction("typing");

  try {
    const { listFiles } = require("./core/integrations/drive");
    const files = await listFiles();
    if (!files || files.length === 0) return ctx.reply("Drive kosong atau tidak terhubung.");

    const list = files.slice(0, 10).map((f, i) => `${i + 1}. ${f.name}`).join("\n");
    await ctx.reply(`📁 FILE DI GOOGLE DRIVE:\n\n${list}`);
  } catch (err) {
    await ctx.reply("Drive tidak terhubung. Cek token Google.");
  }
});

// ═══════════════════════════════════════════════
// DOCUMENT UPLOAD PIPELINE
// ═══════════════════════════════════════════════
bot.on("document", async (ctx) => {
  if (!isAuthorized(ctx.chat.id)) return ctx.reply("Unauthorized.");

  const chatId = ctx.chat.id;
  const document = ctx.message.document;
  const fileId = document.file_id;
  const fileName = document.file_name;

  try {
    const file = await ctx.telegram.getFile(fileId);
    const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${file.file_path}`;
    const uploadDir = path.join(__dirname, "workspace", "uploads");

    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const uploadPath = path.join(uploadDir, fileName);
    const response = await axios({ url: fileUrl, method: "GET", responseType: "stream" });
    const writer = fs.createWriteStream(uploadPath);
    response.data.pipe(writer);

    writer.on("finish", async () => {
      addFileMemory({ fileName, path: uploadPath, uploadedBy: chatId, status: "uploaded" });
      await ctx.reply(`✅ File diterima:\n${fileName}\n\nDisimpan ke:\n${uploadPath}`);
    });

    writer.on("error", async () => {
      await ctx.reply("Gagal simpan file.");
    });

  } catch (err) {
    console.error("DOC UPLOAD ERROR:", err.message);
    await ctx.reply("Error upload dokumen.");
  }
});

// ═══════════════════════════════════════════════
// TEXT COMMAND ROUTER
// ═══════════════════════════════════════════════
bot.on("text", async (ctx) => {
  const originalText = ctx.message.text.trim();
  const text = originalText.toLowerCase();
  const chatId = ctx.chat.id;

  if (!isAuthorized(chatId)) return ctx.reply("Unauthorized.");

  console.log("CMD:", text.substring(0, 60));

  try {
    // ── File management ─────────────────────────────
    if (text.includes("hapus file")) {
      const lastFile = getLastFile();
      if (!lastFile) return ctx.reply("Tidak ada file di memory.");
      return ctx.reply(`Approval diperlukan.\n\nHapus:\n${lastFile.fileName}\n\nBalas:\nAPPROVE DELETE`);
    }

    if (text === "approve delete") {
      const lastFile = getLastFile();
      if (!lastFile) return ctx.reply("Tidak ada file di memory.");
      try {
        fs.unlinkSync(lastFile.path);
        removeFileMemory(lastFile.path);
        return ctx.reply(`✅ Dihapus:\n${lastFile.fileName}`);
      } catch (err) {
        return ctx.reply("Gagal hapus file.");
      }
    }

    // ── TOOLS ────────────────────────────────────────
    if (text.startsWith("/ahs")) {
      const query = originalText.replace(/^\/ahs\s*/i, "").trim();
      if (!query) return ctx.reply("Format: /ahs [deskripsi pekerjaan]\nContoh: /ahs Pasang keramik lantai 60x60 per m2");
      await ctx.sendChatAction("typing");
      const result = await withTyping(ctx, () => runAHS(query));
      return sendLong(ctx, result);
    }

    if (text.startsWith("/rab")) {
      const query = originalText.replace(/^\/rab\s*/i, "").trim();
      if (!query) return ctx.reply("Format: /rab [nama proyek]\nContoh: /rab Gedung kantor 2 lantai Kupang");
      await ctx.sendChatAction("typing");
      const result = await withTyping(ctx, () => runRAB(query));
      return sendLong(ctx, result);
    }

    if (text.startsWith("/draft")) {
      const query = originalText.replace(/^\/draft\s*/i, "").trim();
      if (!query) return ctx.reply("Format: /draft [jenis dokumen + detail]\nContoh: /draft surat penawaran proyek gedung 3 lantai");
      await ctx.sendChatAction("typing");
      const result = await withTyping(ctx, () => runDraft(query));
      return sendLong(ctx, result);
    }

    if (text.startsWith("/harga")) {
      const query = originalText.replace(/^\/harga\s*/i, "").trim();
      if (!query) return ctx.reply("Format: /harga [nama komoditas]\nContoh: /harga mangan NTT");
      await ctx.sendChatAction("typing");
      const result = await withTyping(ctx, () => runPriceCheck(query));
      return sendLong(ctx, result);
    }

    // ── AGENTS ───────────────────────────────────────
    if (text.startsWith("/procurement")) {
      const query = originalText.replace(/^\/procurement\s*/i, "").trim();
      if (!query) return ctx.reply("Format: /procurement [pertanyaan tentang tender/pengadaan]");
      await ctx.sendChatAction("typing");
      const result = await withTyping(ctx, () => runProcurementAgent(query));
      return sendLong(ctx, result);
    }

    if (text.startsWith("/trading")) {
      const query = originalText.replace(/^\/trading\s*/i, "").trim();
      if (!query) return ctx.reply("Format: /trading [topik komoditas/ekspor]");
      await ctx.sendChatAction("typing");
      const result = await withTyping(ctx, () => runTradingAgent(query));
      return sendLong(ctx, result);
    }

    if (text.startsWith("/konstruksi")) {
      const query = originalText.replace(/^\/konstruksi\s*/i, "").trim();
      if (!query) return ctx.reply("Format: /konstruksi [pertanyaan teknis konstruksi]");
      await ctx.sendChatAction("typing");
      const result = await withTyping(ctx, () => runConstructionAgent(query));
      return sendLong(ctx, result);
    }

    if (text.startsWith("/strategi")) {
      const query = originalText.replace(/^\/strategi\s*/i, "").trim();
      if (!query) return ctx.reply("Format: /strategi [situasi bisnis yang ingin dianalisa]");
      await ctx.sendChatAction("typing");
      const result = await withTyping(ctx, () => runStrategyAgent(query));
      return sendLong(ctx, result);
    }

    if (text.startsWith("/admin")) {
      const query = originalText.replace(/^\/admin\s*/i, "").trim();
      if (!query) return ctx.reply("Format: /admin [kebutuhan dokumen/administrasi]");
      await ctx.sendChatAction("typing");
      const result = await withTyping(ctx, () => runAdminAgent(query));
      return sendLong(ctx, result);
    }

    // ── SKILLS ───────────────────────────────────────
    if (text.startsWith("/rangkum")) {
      const query = originalText.replace(/^\/rangkum\s*/i, "").trim();
      if (!query) return ctx.reply("Format: /rangkum [teks yang ingin dirangkum]");
      await ctx.sendChatAction("typing");
      const result = await withTyping(ctx, () => summarize(query));
      return sendLong(ctx, result);
    }

    if (text.startsWith("/terjemah")) {
      const parts = originalText.replace(/^\/terjemah\s*/i, "").trim().split(/\s+/);
      const lang = parts[0] || "";
      const content = parts.slice(1).join(" ");
      if (!lang || !content) return ctx.reply("Format: /terjemah [bahasa] [teks]\nContoh: /terjemah english Selamat pagi");
      await ctx.sendChatAction("typing");
      const result = await withTyping(ctx, () => translate(lang, content));
      return sendLong(ctx, result);
    }

    if (text.startsWith("/analisa")) {
      const query = originalText.replace(/^\/analisa\s*/i, "").trim();
      if (!query) return ctx.reply("Format: /analisa [data atau situasi yang ingin dianalisa]");
      await ctx.sendChatAction("typing");
      const result = await withTyping(ctx, () => analyze(query));
      return sendLong(ctx, result);
    }

    if (text.startsWith("/ingatkan")) {
      const parts = originalText.replace(/^\/ingatkan\s*/i, "").trim().split(/\s+/);
      const minutes = parts[0];
      const message = parts.slice(1).join(" ");
      if (!minutes || !message) return ctx.reply("Format: /ingatkan [menit] [pesan]\nContoh: /ingatkan 30 Cek email klien");
      const result = setReminder(minutes, message);
      return ctx.reply(result);
    }

    // ── SYSTEM COMMANDS ──────────────────────────────
    // /status, /memory, /ingat, /lupa, /drive, /help
    // ditangani oleh bot.command() di atas

    // ── FALLBACK: CHAT BIASA ─────────────────────────
    await ctx.sendChatAction("typing");

    // Auto-extract fakta dari pesan user
    await autoExtract(originalText).catch(() => {});

    // Cari konteks dari memory
    const memResults = await searchMemory(originalText).catch(() => []);
    const memContext = memResults.length > 0
      ? `\nKONTEKS MEMORY:\n${memResults.map(r => `- ${r.text}`).join("\n")}\n`
      : "";

    // Bangun prompt dengan history
    const session = await loadSession(chatId);
    const history = session.history
      .slice(-4)
      .map(m => `${m.role === "assistant" ? "ASSISTANT" : "USER"}: ${m.content.substring(0, 300)}`)
      .join("\n");

    const fullPrompt = history
      ? `${history}${memContext}\nUSER: ${originalText}`
      : `${memContext}${originalText}`;

    const aiReply = await routeTask("light", fullPrompt);
    conversationCountToday++;

    await addMessage(chatId, "user", originalText);
    await addMessage(chatId, "assistant", aiReply);

    return sendLong(ctx, aiReply);

  } catch (err) {
    console.error("TELEGRAM ERROR:", err.message);
    return ctx.reply("Maaf Bry, AI sedang sibuk. Coba lagi dalam beberapa detik.");
  }
});

bot.launch({ dropPendingUpdates: true });

console.log("TERNION-AI TELEGRAM ONLINE");

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));

module.exports = { getConversationCount: () => conversationCountToday };
