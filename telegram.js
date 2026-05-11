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
const { autoExtract, saveConversation, searchMemory, addFact, forgetTopic, getMemorySummary } = require("./core/memory/long-term-memory");

// ─── Tools ─────────────────────────────────────────────
const { runAHS } = require("./core/tools/ahs-tool");
const { runRAB } = require("./core/tools/rab-tool");
const { runDraft } = require("./core/tools/draft-tool");
const { runPriceCheck } = require("./core/tools/price-check-tool");
const { searchWeb } = require("./core/tools/web-search-tool");

// ─── Registry ──────────────────────────────────────────
const { tambahKontak, cariKontak, listKontak, formatKontak } = require("./core/registry/contact-registry");
const { tambahProyek, updateProyek, listProyek, detailProyek, formatProyek } = require("./core/registry/project-registry");

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

// ─── Global error guards — cegah crash dari unhandled rejection ────
process.on("unhandledRejection", (reason) => {
  console.error("[UNHANDLED_REJECTION]", reason instanceof Error ? reason.message : String(reason));
});
process.on("uncaughtException", (err) => {
  console.error("[UNCAUGHT_EXCEPTION]", err.message);
});

// handlerTimeout 120s: beri waktu cukup untuk Claude/Ollama, tapi tidak sampai crash
const bot = new Telegraf(TELEGRAM_TOKEN, { handlerTimeout: 120000 });

// bot.catch() = API resmi Telegraf 4.x untuk error middleware
bot.catch((err, ctx) => {
  console.error("[BOT_CATCH]", err instanceof Error ? err.message : String(err));
  ctx.reply("Maaf Bry, ada kendala teknis. Kirim ulang pesan kamu.").catch(() => {});
});

function isAuthorized(chatId) {
  return AUTHORIZED_USERS.includes(chatId);
}

// ─── Classifier: tentukan task weight sebelum routing ──
function classifyCommand(text) {
  const heavyCommands = ["/ahs", "/rab", "/konstruksi", "/strategi", "/analisa", "/trading", "/procurement"];
  if (heavyCommands.some(cmd => text.startsWith(cmd))) return "heavy";
  return "light";
}

// ─── Helper: kirim pesan panjang — safe, tidak throw ───
async function sendLong(ctx, text) {
  const chunks = [];
  for (let i = 0; i < text.length; i += 4000) {
    chunks.push(text.substring(i, i + 4000));
  }
  for (const chunk of chunks) {
    try { await ctx.reply(chunk); } catch {}
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
/ahs [pekerjaan] → Analisa Harga Satuan
/rab [proyek] → Generate RAB
/draft [dokumen] → Buat draft dokumen/surat
/harga [komoditas] → Cek harga + web search

🌐 <b>WEB SEARCH:</b>
/cari [query] → Web search langsung
/berita [topik] → Search berita terbaru

🤝 <b>AGENTS (model 7b):</b>
/procurement → Tender &amp; pengadaan
/trading → Komoditas &amp; ekspor
/konstruksi → Proyek konstruksi
/strategi → Strategi bisnis
/admin → Dokumen &amp; administrasi

⚡ <b>SKILLS:</b>
/rangkum → Rangkum teks
/terjemah [bahasa] [teks] → Terjemahan
/analisa [data] → Analisa strategis
/ingatkan [menit] [pesan] → Set reminder

📋 <b>REGISTRY:</b>
/kontak tambah|cari|list → Kelola kontak
/proyek tambah|update|list → Kelola proyek

🧠 <b>MEMORY:</b>
/memory → Ringkasan memory per domain
/ingat [fakta] → Tambah fakta baru
/lupa [topik] → Hapus memory

⚙️ <b>SISTEM:</b>
/status → Status sistem (RAM, model, soul)
/drive → File di Google Drive
/help → Menu ini
━━━━━━━━━━━━━━━━━━━━━━━━━
💬 Atau kirim pesan bebas untuk ngobrol!
🔍 Auto web search jika ada kata: cari, harga terbaru, berita, info terbaru`;

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
  const d = summary.domains || {};
  const msg =
`🧠 <b>TERNION MEMORY</b>
━━━━━━━━━━━━━━━━━━━
👤 Personal: ${(d.personal?.count) || 0} fakta
💼 Bisnis: ${(d.bisnis?.count) || 0} fakta
🏗️ Proyek: ${(d.proyek?.count) || 0} aktif
👥 Kontak: ${(d.kontak?.count) || 0} orang
⚡ Keputusan: ${(d.keputusan?.count) || 0} entri
💬 Percakapan: ${(d.percakapan?.count) || 0} sesi
━━━━━━━━━━━━━━━━━━━
📊 Total fakta: ${summary.total_facts}
📚 Learnings: ${summary.total_learnings}
☁️ Last backup: ${summary.last_backup}

🎯 <b>Proyek/Deadline:</b>
${summary.active_projects}

💡 <b>Keputusan Terakhir:</b>
${summary.latest_decisions}

🔬 <b>Learning Terbaru:</b>
${summary.latest_learnings}`;

  await ctx.replyWithHTML(msg);
});

// ─── /kontak ───────────────────────────────────────────
bot.command("kontak", async (ctx) => {
  if (!isAuthorized(ctx.chat.id)) return;
  const args = ctx.message.text.replace("/kontak", "").trim();
  const parts = args.split(/\s+/);
  const sub = parts[0]?.toLowerCase();

  if (sub === "tambah") {
    const [, nama, perusahaan, telp, ...catatanParts] = parts;
    if (!nama) return ctx.reply("Format: /kontak tambah [nama] [perusahaan] [telp] [catatan]");
    await tambahKontak(nama, perusahaan, telp, catatanParts.join(" "));
    return ctx.reply(`✅ Kontak <b>${nama}</b> tersimpan.`, { parse_mode: "HTML" });
  }

  if (sub === "cari") {
    const query = parts.slice(1).join(" ");
    if (!query) return ctx.reply("Format: /kontak cari [nama]");
    const results = await cariKontak(query);
    if (results.length === 0) return ctx.reply(`Tidak ada kontak ditemukan untuk "${query}"`);
    const list = results.slice(0, 10).map((k, i) => formatKontak(k, i)).join("\n\n");
    return ctx.replyWithHTML(`👥 <b>Hasil Pencarian Kontak:</b>\n\n${list}`);
  }

  if (sub === "list" || !sub) {
    const all = await listKontak();
    if (all.length === 0) return ctx.reply("Belum ada kontak tersimpan. Gunakan /kontak tambah");
    const list = all.slice(-15).map((k, i) => formatKontak(k, i)).join("\n\n");
    return ctx.replyWithHTML(`👥 <b>DAFTAR KONTAK TERNION</b>\n━━━━━━━━━━━━━━━━━━\n\n${list}`);
  }

  return ctx.reply("Sub-command: tambah | cari | list");
});

// ─── /proyek ───────────────────────────────────────────
bot.command("proyek", async (ctx) => {
  if (!isAuthorized(ctx.chat.id)) return;
  await ctx.sendChatAction("typing");
  const originalArgs = ctx.message.text.replace("/proyek", "").trim();
  const parts = originalArgs.split(/\s+/);
  const sub = parts[0]?.toLowerCase();

  if (sub === "tambah") {
    const nama = parts[1];
    const nilai = parts[2];
    const deadline = parts[3];
    const status = parts[4] || "tender";
    if (!nama) return ctx.reply("Format: /proyek tambah [nama] [nilai] [deadline YYYY-MM-DD] [status]");
    await tambahProyek(nama, nilai, deadline, status);
    return ctx.replyWithHTML(`✅ Proyek <b>${nama}</b> tersimpan.\n💰 Nilai: ${nilai || "N/A"}\n📅 Deadline: ${deadline || "N/A"}\n📊 Status: ${status}`);
  }

  if (sub === "update") {
    const nama = parts[1];
    const statusBaru = parts.slice(2).join(" ");
    if (!nama || !statusBaru) return ctx.reply("Format: /proyek update [nama] [status baru]");
    const n = await updateProyek(nama, statusBaru);
    return ctx.reply(n > 0 ? `✅ ${n} proyek diupdate ke status "${statusBaru}"` : `Proyek "${nama}" tidak ditemukan.`);
  }

  if (sub === "list" || !sub) {
    const all = await listProyek();
    if (all.length === 0) return ctx.reply("Belum ada proyek. Gunakan /proyek tambah");
    const list = all.slice(-10).map((p, i) => formatProyek(p, i)).join("\n\n");
    return ctx.replyWithHTML(`🏗️ <b>PROYEK AKTIF TERNION</b>\n━━━━━━━━━━━━━━━━━━\n\n${list}`);
  }

  // Cari proyek by nama
  const results = await detailProyek(originalArgs);
  if (results.length === 0) return ctx.reply(`Proyek "${originalArgs}" tidak ditemukan.`);
  const list = results.map((p, i) => formatProyek(p, i)).join("\n\n");
  return ctx.replyWithHTML(`🏗️ <b>Detail Proyek:</b>\n\n${list}`);
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
      // Coba web search dulu, lalu inject ke AI untuk analisa
      let webCtx = "";
      try { webCtx = await searchWeb(`harga ${query} terbaru 2026`); } catch {}
      const result = await withTyping(ctx, () => runPriceCheck(query + (webCtx ? `\n\nData web terbaru:\n${webCtx}` : "")));
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

    // ── WEB SEARCH ───────────────────────────────────
    if (text.startsWith("/cari") || text.startsWith("/berita")) {
      const query = originalText.replace(/^\/(cari|berita)\s*/i, "").trim();
      if (!query) return ctx.reply("Format: /cari [topik]\nContoh: /cari harga mangan NTT 2026");
      await ctx.sendChatAction("typing");
      const result = await withTyping(ctx, () => searchWeb(query));
      return sendLong(ctx, result);
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

    // Auto web search jika pesan mengandung kata kunci tertentu
    const webTriggers = ["cari", "search", "harga terbaru", "berita", "info terbaru", "berapa harga", "update terbaru"];
    let webContext = "";
    if (webTriggers.some(kw => text.includes(kw))) {
      try { webContext = `\nINFO WEB TERBARU:\n${await searchWeb(originalText)}\n`; } catch {}
    }

    // Bangun prompt dengan history
    const session = await loadSession(chatId);
    const history = session.history
      .slice(-4)
      .map(m => `${m.role === "assistant" ? "ASSISTANT" : "USER"}: ${m.content.substring(0, 300)}`)
      .join("\n");

    const fullPrompt = history
      ? `${history}${memContext}${webContext}\nUSER: ${originalText}`
      : `${memContext}${webContext}${originalText}`;

    const taskType = classifyCommand(text);
    const aiReply = await routeTask(taskType, fullPrompt);
    conversationCountToday++;

    await addMessage(chatId, "user", originalText);
    await addMessage(chatId, "assistant", aiReply);

    // Simpan percakapan ke semua domain memory yang relevan
    saveConversation(originalText, aiReply).catch(err =>
      console.error("[MEMORY] saveConversation error:", err.message)
    );

    return sendLong(ctx, aiReply);

  } catch (err) {
    console.error("[TELEGRAM_ERROR]", err.message);
    // PENTING: await + try-catch terpisah — jangan return Promise yang bisa reject
    try { await ctx.reply("Maaf Bry, AI sedang sibuk. Coba lagi dalam beberapa detik."); } catch {}
  }
});

bot.launch({ dropPendingUpdates: true }).catch((err) => {
  console.error("[BOT_LAUNCH_ERROR]", err.message);
});

console.log("TERNION-AI TELEGRAM ONLINE");

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));

module.exports = { getConversationCount: () => conversationCountToday };
