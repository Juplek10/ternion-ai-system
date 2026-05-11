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
const { addPositive, addNegative, addNegativeExplanation, addKnowledge } = require("./core/memory/feedback-memory");

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

// ─── State: track pesan AI terakhir untuk feedback ──────
const lastAIContext = new Map();    // chatId → { userMsg, aiReply }
const pendingFeedback = new Map();  // chatId → "negative_explanation" | "knowledge_addition"
const pendingAction  = new Map();   // chatId → { action, data } untuk interactive menu

// ─── Keyboard builder helpers ─────────────────────────
const btn  = (text, data) => ({ text, callback_data: data.substring(0, 64) });
const btnBack = (target) => btn("⬅️ Kembali", target);
const btnHome = () => btn("🏠 Menu Utama", "h");

function kb(...rows) {
  return { reply_markup: { inline_keyboard: rows } };
}

function fileIcon(mimeType) {
  if (!mimeType) return "📄";
  if (mimeType.includes("folder"))       return "📁";
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) return "📊";
  if (mimeType.includes("pdf"))          return "📋";
  if (mimeType.includes("image"))        return "🖼️";
  if (mimeType.includes("document") || mimeType.includes("word")) return "📄";
  if (mimeType.includes("presentation")) return "📌";
  if (mimeType.includes("video"))        return "🎬";
  if (mimeType.includes("audio"))        return "🎵";
  if (mimeType.includes("zip") || mimeType.includes("rar")) return "📦";
  return "📄";
}

function formatBytes(bytes) {
  if (!bytes) return "—";
  const b = parseInt(bytes);
  if (b < 1024) return b + " B";
  if (b < 1048576) return (b / 1024).toFixed(1) + " KB";
  return (b / 1048576).toFixed(1) + " MB";
}

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Makassar" });
}

async function editMenu(ctx, text, keyboard_rows) {
  try {
    await ctx.editMessageText(text, {
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: keyboard_rows },
      disable_web_page_preview: true
    });
  } catch {
    await ctx.reply(text, {
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: keyboard_rows },
      disable_web_page_preview: true
    });
  }
}

async function sendMenu(ctx, text, keyboard_rows) {
  await ctx.replyWithHTML(text, {
    reply_markup: { inline_keyboard: keyboard_rows },
    disable_web_page_preview: true
  });
}

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
  await sendHelpMain(ctx, "send");
});

async function sendHelpMain(ctx, mode = "send") {
  const text =
`🤖 <b>TERNION-AI COMMAND CENTER</b>
━━━━━━━━━━━━━━━━━━━━━━━━━
👤 Halo Bry! Pilih kategori:`;

  const rows = [
    [btn("🛠️ Tools", "h:t"),     btn("🤝 Agents", "h:a")],
    [btn("⚡ Skills", "h:s"),    btn("🧠 Memory", "h:m")],
    [btn("⚙️ Sistem", "h:sy"),   btn("📱 WhatsApp", "h:w")],
    [btn("💬 Chat bebas", "h:chat")]
  ];

  if (mode === "edit") await editMenu(ctx, text, rows);
  else await sendMenu(ctx, text, rows);
}

// ─── /status ───────────────────────────────────────────
bot.command("status", async (ctx) => {
  if (!isAuthorized(ctx.chat.id)) return;
  await ctx.sendChatAction("typing");
  await sendStatusMenu(ctx, "send");
});

async function buildStatusText() {
  let ram = { usedGB: "?", totalGB: "?", pct: "?" };
  try {
    const meminfo = fs.readFileSync("/proc/meminfo", "utf8");
    const total = parseInt(meminfo.match(/MemTotal:\s+(\d+)/)[1]) * 1024;
    const avail = parseInt(meminfo.match(/MemAvailable:\s+(\d+)/)[1]) * 1024;
    const used  = total - avail;
    ram.pct    = Math.round((used / total) * 100);
    ram.usedGB = (used / 1e9).toFixed(1);
    ram.totalGB= (total / 1e9).toFixed(1);
  } catch {}

  let claudeStatus = "✅ Claude (primary)";
  try {
    const { execSync } = require("child_process");
    execSync("claude --version", { timeout: 5000, stdio: "pipe" });
  } catch { claudeStatus = "❌ Claude CLI tidak tersedia"; }

  const soul = getSoul();
  const soulStatus = soul && soul.length > 100 ? "✅ loaded" : "❌ error";
  const timeStr = new Date().toLocaleString("id-ID", { timeZone: "Asia/Makassar" });

  let waAiStatus = "❓ unknown";
  try {
    const { getStatus: getWAStatus } = require("./core/contacts/master-switch");
    waAiStatus = await getWAStatus();
  } catch {}

  const ramBar = "█".repeat(Math.round((ram.pct || 0) / 10)) + "░".repeat(10 - Math.round((ram.pct || 0) / 10));
  const ramColor = (ram.pct || 0) > 80 ? "🔴" : (ram.pct || 0) > 60 ? "🟡" : "🟢";

  return `⚙️ <b>STATUS TERNION-AI</b>
─────────────────────
⏰ ${timeStr} WITA
🤖 AI: ${claudeStatus}
📱 AI WA: ${waAiStatus}
${ramColor} RAM: ${ramBar} ${ram.pct}%
   ${ram.usedGB} / ${ram.totalGB} GB
💬 Percakapan hari ini: ${conversationCountToday}
🔋 Soul: ${soulStatus}
📡 Bot: ✅ online`;
}

async function sendStatusMenu(ctx, mode = "send") {
  const text = await buildStatusText();
  const rows = [
    [btn("🔄 Restart Bot", "st:rb"),    btn("💾 Backup Sekarang", "st:bk")],
    [btn("📊 Lihat Logs",  "st:lg"),    btn("🧹 Clear Cache",     "st:cc")],
    [btn("📱 AI WA Status","st:wa")]
  ];
  if (mode === "edit") await editMenu(ctx, text, rows);
  else await sendMenu(ctx, text, rows);
}

// ─── /memory ───────────────────────────────────────────
bot.command("memory", async (ctx) => {
  if (!isAuthorized(ctx.chat.id)) return;
  await ctx.sendChatAction("typing");
  await sendMemoryMain(ctx, "send");
});

async function sendMemoryMain(ctx, mode = "send") {
  const summary = await getMemorySummary();
  const d = summary.domains || {};
  const counts = {
    p:  d.personal?.count  || 0,
    b:  d.bisnis?.count    || 0,
    pr: d.proyek?.count    || 0,
    k:  d.kontak?.count    || 0,
    kp: d.keputusan?.count || 0,
    c:  d.percakapan?.count|| 0,
  };

  const text =
`🧠 <b>TERNION MEMORY</b>
━━━━━━━━━━━━━━━━━━━
📊 Total: ${summary.total_facts} fakta | ${summary.total_learnings} learnings
☁️ Backup: ${summary.last_backup}

Tap domain untuk lihat entri:`;

  const rows = [
    [btn(`👤 Personal (${counts.p})`,    "m:p:0"),  btn(`💼 Bisnis (${counts.b})`,     "m:b:0")],
    [btn(`🏗️ Proyek (${counts.pr})`,    "m:pr:0"), btn(`👥 Kontak (${counts.k})`,     "m:k:0")],
    [btn(`⚡ Keputusan (${counts.kp})`,  "m:kp:0"), btn(`💬 Percakapan (${counts.c})`, "m:c:0")]
  ];

  if (mode === "edit") await editMenu(ctx, text, rows);
  else await sendMenu(ctx, text, rows);
}

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
    return sendKontakList(ctx, 0, "send");
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
    return sendProyekList(ctx, 0, "send");
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
  await sendDriveFolder(ctx, "root", "send");
});

async function sendDriveFolder(ctx, folderId, mode) {
  try {
    const { listFilesInFolder } = require("./core/integrations/drive");
    const files = await listFilesInFolder(folderId);

    if (!files || files.length === 0) {
      const text = folderId === "root"
        ? "📁 <b>Google Drive</b>\n\nDrive kosong atau tidak ada file."
        : "📁 Folder ini kosong.";
      const rows = folderId !== "root" ? [[btnBack("dr:root")]] : [];
      if (mode === "edit") await editMenu(ctx, text, rows);
      else await sendMenu(ctx, text, rows);
      return;
    }

    const folderName = folderId === "root" ? "Google Drive" : "Folder";
    const text = `📁 <b>${folderName}</b>\n━━━━━━━━━━━━━━━━━\n${files.length} item`;

    const rows = files.map(f => {
      const icon = fileIcon(f.mimeType);
      const isFolder = f.mimeType === "application/vnd.google-apps.folder";
      const cbData = isFolder ? `dr:f:${f.id}` : `dr:fi:${f.id}`;
      const label = `${icon} ${f.name}`.substring(0, 40);
      return [btn(label, cbData)];
    });

    if (folderId !== "root") {
      rows.push([btnBack("dr:root"), btnHome()]);
    } else {
      rows.push([btn("🔄 Refresh", "dr:root")]);
    }

    if (mode === "edit") await editMenu(ctx, text, rows);
    else await sendMenu(ctx, text, rows);
  } catch (err) {
    const errText = "❌ Drive tidak terhubung.\nPastikan token Google valid.";
    if (mode === "edit") await editMenu(ctx, errText, []);
    else await ctx.reply(errText);
  }
}

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

  // ── Intercept pending interactive actions ─────────
  if (pendingAction.has(chatId)) {
    const action = pendingAction.get(chatId);
    pendingAction.delete(chatId);
    if (action.action === "proyek_update") {
      const idx = action.idx;
      try {
        const fsExtra = require("fs-extra");
        const PROJ_FILE = "/root/ai-system/memory/proyek.json";
        const d2 = await fsExtra.readJson(PROJ_FILE).catch(() => ({ entries: [] }));
        const entries = d2.entries || [];
        if (entries[idx]) {
          entries[idx].status = originalText.trim();
          entries[idx].updated_at = new Date().toISOString();
          await fsExtra.writeJson(PROJ_FILE, { ...d2, entries }, { spaces: 2 });
          await ctx.reply(`✅ Status proyek diupdate ke: "${originalText.trim()}"`);
        } else {
          await ctx.reply("❌ Proyek tidak ditemukan.");
        }
      } catch (err) {
        await ctx.reply(`❌ Gagal update: ${err.message}`);
      }
      return;
    }
  }

  // ── Intercept feedback follow-up ─────────────────
  if (pendingFeedback.has(chatId)) {
    const feedbackType = pendingFeedback.get(chatId);
    pendingFeedback.delete(chatId);
    if (feedbackType === "negative_explanation") {
      await addNegativeExplanation(originalText).catch(() => {});
      await ctx.reply("✅ Terima kasih Bry! Saya catat untuk diperbaiki.");
      // Update agent performance tracking
      try {
        const { recordNegativeFeedback } = require("./core/evolution/agent-evolution");
        await recordNegativeFeedback("chat", originalText);
      } catch {}
      return;
    }
    if (feedbackType === "knowledge_addition") {
      await addKnowledge(originalText).catch(() => {});
      // Update knowledge base
      try {
        const { updateKnowledgeFromConversation } = require("./core/knowledge/ternion-knowledge");
        await updateKnowledgeFromConversation(originalText);
      } catch {}
      await ctx.reply(`✅ Tersimpan sebagai knowledge baru:\n"${originalText.substring(0, 100)}"`);
      return;
    }
  }

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

    // ── DYNAMIC SKILLS (dibuat via /skill baru) ───────
    if (text.startsWith("/") && !text.startsWith("/ ")) {
      const cmdRaw = text.split(/\s+/)[0].replace("/", "");
      const query = originalText.slice(cmdRaw.length + 1).trim();
      const { runDynamicSkill } = require("./core/evolution/skill-builder");
      const skillResult = await runDynamicSkill(cmdRaw, query);
      if (skillResult !== null) {
        await ctx.sendChatAction("typing");
        return sendLong(ctx, skillResult);
      }
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

    // Kirim balasan + feedback keyboard
    lastAIContext.set(chatId, { userMsg: originalText, aiReply });
    await sendLong(ctx, aiReply);
    try {
      await ctx.reply("─", {
        reply_markup: {
          inline_keyboard: [[
            { text: "👍 Bagus", callback_data: "fb_positive" },
            { text: "👎 Kurang tepat", callback_data: "fb_negative" },
            { text: "💡 Tambahkan", callback_data: "fb_add" }
          ]]
        }
      });
    } catch {}
    return;

  } catch (err) {
    console.error("[TELEGRAM_ERROR]", err.message);
    // PENTING: await + try-catch terpisah — jangan return Promise yang bisa reject
    try { await ctx.reply("Maaf Bry, AI sedang sibuk. Coba lagi dalam beberapa detik."); } catch {}
  }
});

// ─── Helper: Proyek list ───────────────────────────────
async function sendProyekList(ctx, page, mode) {
  const PAGE_SIZE = 8;
  const all = await listProyek();
  if (all.length === 0) {
    const t = "🏗️ <b>PROYEK TERNION</b>\n\nBelum ada proyek.\nGunakan /proyek tambah";
    if (mode === "edit") await editMenu(ctx, t, []);
    else await ctx.replyWithHTML(t);
    return;
  }

  const total = all.length;
  const start = page * PAGE_SIZE;
  const slice = all.slice(start, start + PAGE_SIZE);

  const text = `🏗️ <b>PROYEK TERNION</b>\n━━━━━━━━━━━━━━━━━\n${total} proyek — halaman ${page + 1}`;

  const STATUS_ICONS = { tender:"🔵", aktif:"🟢", selesai:"✅", ditunda:"🟡", batal:"🔴" };

  const rows = slice.map((p, i) => {
    const realIdx = start + i;
    const icon = STATUS_ICONS[p.status?.toLowerCase()] || "🏗️";
    const label = `${icon} ${(p.nama || p.name || "Tanpa nama").substring(0, 28)} – ${p.status || "?"}`;
    return [btn(label, `pj:v:${realIdx}`)];
  });

  const navRow = [];
  if (page > 0)                              navRow.push(btn("⬅️ Prev", `pj:${page-1}`));
  if (start + PAGE_SIZE < total)             navRow.push(btn("➡️ Next", `pj:${page+1}`));
  if (navRow.length) rows.push(navRow);
  rows.push([btnHome()]);

  if (mode === "edit") await editMenu(ctx, text, rows);
  else await sendMenu(ctx, text, rows);
}

async function sendProyekDetail(ctx, idx, mode) {
  const all = await listProyek();
  const p = all[idx];
  if (!p) { await editMenu(ctx, "❌ Proyek tidak ditemukan.", [[btnBack("pj:0")]]); return; }

  const text =
`🏗️ <b>${p.nama || p.name}</b>
━━━━━━━━━━━━━━━━━
📊 Status: ${p.status || "—"}
💰 Nilai: ${p.nilai || "—"}
📅 Deadline: ${p.deadline || "—"}
📝 Catatan: ${(p.catatan || p.notes || "—").substring(0, 200)}`;

  const rows = [
    [btn("✏️ Update Status", `pj:u:${idx}`), btn("🗑️ Hapus", `pj:d:${idx}`)],
    [btn("📋 Buat RAB", `pj:rab:${idx}`)],
    [btnBack("pj:0"), btnHome()]
  ];

  if (mode === "edit") await editMenu(ctx, text, rows);
  else await sendMenu(ctx, text, rows);
}

// ─── Helper: Kontak WA list ────────────────────────────
async function sendKontakList(ctx, page, mode) {
  const PAGE_SIZE = 8;
  const { listContacts } = require("./core/contacts/contact-manager");
  const all = (await listContacts()).filter(c => !c.nomor.includes("XXXXXXX") && !c.nomor.startsWith("_"));

  if (all.length === 0) {
    const t = "👥 <b>KONTAK WA</b>\n\nBelum ada kontak terdaftar.\nGunakan /wa_add untuk menambah.";
    if (mode === "edit") await editMenu(ctx, t, []);
    else await ctx.replyWithHTML(t);
    return;
  }

  const total = all.length;
  const start = page * PAGE_SIZE;
  const slice = all.slice(start, start + PAGE_SIZE);

  const CAT_ICONS = { nexus:"👑", internal:"🏢", kontraktor:"🔨", supplier:"📦", pengepul:"⛏️", relasi:"🤝", pemerintah:"🏛️", tidak_dikenal:"❓" };

  const text = `👥 <b>KONTAK WA TERNION</b>\n━━━━━━━━━━━━━━━━━\n${total} kontak — halaman ${page + 1}`;

  const rows = slice.map(c => {
    const icon = CAT_ICONS[c.kategori] || "👤";
    const label = `${icon} ${(c.nama || c.nomor).substring(0, 25)} (${c.kategori || "?"})`;
    return [btn(label, `kn:v:${c.nomor}`.substring(0, 64))];
  });

  const navRow = [];
  if (page > 0)                              navRow.push(btn("⬅️ Prev", `kn:${page-1}`));
  if (start + PAGE_SIZE < total)             navRow.push(btn("➡️ Next", `kn:${page+1}`));
  if (navRow.length) rows.push(navRow);
  rows.push([btnHome()]);

  if (mode === "edit") await editMenu(ctx, text, rows);
  else await sendMenu(ctx, text, rows);
}

async function sendKontakDetail(ctx, nomor, mode) {
  const { getContact, formatContactInfo } = require("./core/contacts/contact-manager");
  const c = await getContact(nomor);
  if (!c) { await editMenu(ctx, `❌ Kontak ${nomor} tidak ditemukan.`, [[btnBack("kn:0")]]); return; }

  const CAT_ICONS = { nexus:"👑", internal:"🏢", kontraktor:"🔨", supplier:"📦", pengepul:"⛏️", relasi:"🤝", pemerintah:"🏛️", tidak_dikenal:"❓" };
  const icon = CAT_ICONS[c.kategori] || "👤";

  const text =
`${icon} <b>${c.nama || c.nomor}</b>
━━━━━━━━━━━━━━━━━
📞 Nomor: ${c.nomor}
🏷️ Kategori: ${c.kategori} | ${c.role || "—"}
💬 Gaya: ${c.gaya_bicara || "—"}
🔒 Info sensitif: ${c.info_sensitif ? "Ya" : "Tidak"}
✅ Perlu approval: ${c.perlu_approval ? "Ya" : "Tidak"}
💼 Konteks: ${(c.konteks_bisnis || "—").substring(0, 100)}
📊 Interaksi: ${c.total_interactions || 0}x
🕐 Terakhir: ${c.last_interaction ? c.last_interaction.split("T")[0] : "belum"}`;

  const rows = [
    [btn("💬 Lihat History", `kn:h:${nomor}`.substring(0,64)), btn("🗑️ Hapus", `kn:del:${nomor}`.substring(0,64))],
    [btnBack("kn:0"), btnHome()]
  ];

  if (mode === "edit") await editMenu(ctx, text, rows);
  else await sendMenu(ctx, text, rows);
}

// ─── Helper: Memory domain entries ────────────────────
async function sendMemoryDomain(ctx, domain, offset, mode) {
  const PAGE_SIZE = 5;
  const MEMORY_DIR = "/root/ai-system/memory";
  const fsExtra = require("fs-extra");

  const domainFiles = {
    p:  "personal.json",
    b:  "bisnis.json",
    pr: "proyek.json",
    k:  "kontak.json",
    kp: "keputusan.json",
    c:  "percakapan.json"
  };

  const domainLabels = {
    p: "👤 Personal", b: "💼 Bisnis", pr: "🏗️ Proyek",
    k: "👥 Kontak",   kp: "⚡ Keputusan", c: "💬 Percakapan"
  };

  const file = domainFiles[domain];
  if (!file) { await editMenu(ctx, "❌ Domain tidak dikenal.", [[btnBack("m")]]); return; }

  let entries = [];
  try {
    const data = await fsExtra.readJson(`${MEMORY_DIR}/${file}`).catch(() => null);
    entries = data?.entries || data?.data || [];
    if (!Array.isArray(entries)) entries = Object.values(entries).filter(v => typeof v === "string" || v?.content);
  } catch {}

  const label = domainLabels[domain] || domain;
  const total = entries.length;
  const slice = entries.slice(offset, offset + PAGE_SIZE);

  if (total === 0) {
    await editMenu(ctx, `${label}\n\nBelum ada data.`, [[btnBack("m")]]);
    return;
  }

  const text = `${label}\n━━━━━━━━━━━━━━━━━\n${total} entri — menampilkan ${offset + 1}–${Math.min(offset + PAGE_SIZE, total)}:\n\n` +
    slice.map((e, i) => {
      const content = (e?.content || e?.text || e?.value || String(e)).substring(0, 120);
      const ts = e?.created_at ? `\n<i>${e.created_at.split("T")[0]}</i>` : "";
      return `${offset + i + 1}. ${content}${ts}`;
    }).join("\n\n");

  const navRow = [];
  if (offset > 0)                          navRow.push(btn("⬅️ Prev", `m:${domain}:${offset - PAGE_SIZE}`));
  if (offset + PAGE_SIZE < total)          navRow.push(btn("➡️ Selanjutnya", `m:${domain}:${offset + PAGE_SIZE}`));
  const rows = [];
  if (navRow.length) rows.push(navRow);
  rows.push([btnBack("m"), btnHome()]);

  if (mode === "edit") await editMenu(ctx, text, rows);
  else await sendMenu(ctx, text, rows);
}

// ─── INTERACTIVE CALLBACK HANDLER ─────────────────────
bot.on("callback_query", async (ctx) => {
  const chatId = ctx.chat?.id || ctx.callbackQuery?.message?.chat?.id;
  if (!isAuthorized(chatId)) return ctx.answerCbQuery("Unauthorized");

  const data = ctx.callbackQuery.data;
  const context = lastAIContext.get(chatId) || { userMsg: "", aiReply: "" };

  await ctx.answerCbQuery().catch(() => {});

  // ── FEEDBACK ─────────────────────────────────────────
  if (data === "fb_positive") {
    addPositive(context.userMsg, context.aiReply).catch(() => {});
    await ctx.editMessageText("─ 👍 Noted!").catch(() => {});
    return;
  }
  if (data === "fb_negative") {
    addNegative(context.userMsg, context.aiReply).catch(() => {});
    pendingFeedback.set(chatId, "negative_explanation");
    await ctx.editMessageText("─ 👎 Dicatat.").catch(() => {});
    await ctx.reply("Maaf Bry, apa yang kurang tepat? Saya catat untuk diperbaiki.").catch(() => {});
    return;
  }
  if (data === "fb_add") {
    pendingFeedback.set(chatId, "knowledge_addition");
    await ctx.editMessageText("─ 💡 Tambahkan...").catch(() => {});
    await ctx.reply("Apa yang ingin kamu tambahkan atau koreksi, Bry?").catch(() => {});
    return;
  }

  // ── HELP MENUS ────────────────────────────────────────
  if (data === "h") {
    await sendHelpMain(ctx, "edit");
    return;
  }
  if (data === "h:t") {
    await editMenu(ctx,
`🛠️ <b>TOOLS</b>
━━━━━━━━━━━━━━━━━
/ahs [pekerjaan] — Analisa Harga Satuan
/rab [proyek] — Generate RAB lengkap
/draft [dokumen] — Buat draft dokumen/surat
/harga [komoditas] — Cek harga + web search
/cari [query] — Web search langsung
/berita [topik] — Search berita terbaru`,
      [[btnBack("h"), btnHome()]]);
    return;
  }
  if (data === "h:a") {
    await editMenu(ctx,
`🤝 <b>AGENTS</b>
━━━━━━━━━━━━━━━━━
/procurement — Tender & pengadaan
/trading — Komoditas & ekspor
/konstruksi — Proyek konstruksi
/strategi — Strategi bisnis
/admin — Dokumen & administrasi`,
      [[btnBack("h"), btnHome()]]);
    return;
  }
  if (data === "h:s") {
    await editMenu(ctx,
`⚡ <b>SKILLS</b>
━━━━━━━━━━━━━━━━━
/rangkum [teks] — Rangkum teks
/terjemah [bahasa] [teks] — Terjemahan
/analisa [data] — Analisa strategis
/ingatkan [menit] [pesan] — Set reminder
/skill list — Dynamic skills
/skill baru [nama]: [deskripsi] — Buat skill`,
      [[btnBack("h"), btnHome()]]);
    return;
  }
  if (data === "h:m") {
    await editMenu(ctx,
`🧠 <b>MEMORY</b>
━━━━━━━━━━━━━━━━━
/memory — Browser memory interaktif
/ingat [fakta] — Tambah fakta baru
/lupa [topik] — Hapus memory
/knowledge [topik] — Lihat knowledge base
/update [topik] [fakta] — Update knowledge`,
      [[btn("🧠 Buka Memory", "m"), btnBack("h")], [btnHome()]]);
    return;
  }
  if (data === "h:sy") {
    await editMenu(ctx,
`⚙️ <b>SISTEM</b>
━━━━━━━━━━━━━━━━━
/status — Status sistem + quick actions
/drive — Google Drive browser
/ai_off /ai_on /ai_pause [menit]
/approve [ID] — Setujui approval WA
/reject [ID] [alasan] — Tolak approval
/tunda [ID] — Tunda approval
/followup — Daftar follow-up pending`,
      [[btn("⚙️ Buka Status", "st:view"), btn("📁 Drive", "dr:root")],
       [btnBack("h"), btnHome()]]);
    return;
  }
  if (data === "h:w") {
    await editMenu(ctx,
`📱 <b>WHATSAPP</b>
━━━━━━━━━━━━━━━━━
/wa_list — Daftar kontak WA terdaftar
/wa_add [nomor] [kat] [nama] — Tambah kontak
/ai_status — Status AI WhatsApp
/ai_off — Matikan AI WA
/ai_on — Aktifkan AI WA
/ai_pause [menit] — Pause sementara`,
      [[btn("👥 Kontak WA", "kn:0"), btnBack("h")], [btnHome()]]);
    return;
  }
  if (data === "h:chat") {
    await editMenu(ctx, "💬 Kirim saja pesan bebas, Bry!\nAku siap ngobrol, analisa, atau bantu apapun.", [[btnHome()]]);
    return;
  }

  // ── STATUS ACTIONS ────────────────────────────────────
  if (data === "st:view") {
    await sendStatusMenu(ctx, "edit");
    return;
  }
  if (data === "st:rb") {
    await editMenu(ctx,
      "🔄 <b>Restart Bot?</b>\n\nBot Telegram akan di-restart.\nProses lain (WA, worker) tidak terganggu.",
      [[btn("✅ Ya, Restart", "st:rb:ok"), btn("❌ Batal", "st:view")]]);
    return;
  }
  if (data === "st:rb:ok") {
    await editMenu(ctx, "🔄 Merestart bot...", []);
    await ctx.reply("✅ Bot di-restart. Kembali online dalam ~5 detik.").catch(() => {});
    setTimeout(() => process.exit(0), 1000);
    return;
  }
  if (data === "st:bk") {
    await editMenu(ctx, "⏳ Menjalankan backup...", []);
    try {
      const { execSync } = require("child_process");
      execSync("pm2 trigger backup-scheduler backup", { timeout: 10000, stdio: "pipe" });
      await editMenu(ctx, "✅ Backup berhasil dijalankan!", [[btnBack("st:view")]]);
    } catch {
      await editMenu(ctx, "💾 Backup dijadwalkan. Cek backup-scheduler logs.", [[btnBack("st:view")]]);
    }
    return;
  }
  if (data === "st:lg") {
    try {
      const { execSync } = require("child_process");
      const logs = execSync("pm2 logs --nostream --lines 15 telegram 2>&1", { timeout: 5000 }).toString();
      await editMenu(ctx, `📊 <b>Logs (15 baris terakhir):</b>\n\n<pre>${logs.substring(0, 3000).replace(/</g,"&lt;")}</pre>`,
        [[btnBack("st:view")]]);
    } catch {
      await editMenu(ctx, "❌ Gagal ambil logs.", [[btnBack("st:view")]]);
    }
    return;
  }
  if (data === "st:cc") {
    try {
      const { execSync } = require("child_process");
      execSync("find /root/ai-system/memory/wa-states -name '*.json' -delete 2>/dev/null || true", { timeout: 5000 });
      await editMenu(ctx, "✅ Cache WA states dibersihkan!", [[btnBack("st:view")]]);
    } catch {
      await editMenu(ctx, "❌ Gagal clear cache.", [[btnBack("st:view")]]);
    }
    return;
  }
  if (data === "st:wa") {
    const { getStatus: getWAStatus } = require("./core/contacts/master-switch");
    const waStatus = await getWAStatus().catch(() => "❓ unknown");
    await editMenu(ctx, `📱 <b>Status AI WhatsApp</b>\n\n${waStatus}`,
      [[btn("🟢 Aktifkan", "st:wa:on"), btn("🔴 Matikan", "st:wa:off")],
       [btn("⏸️ Pause 30m", "st:wa:p30"), btnBack("st:view")]]);
    return;
  }
  if (data === "st:wa:on") {
    const { activateAI } = require("./core/contacts/master-switch");
    await activateAI("telegram");
    await editMenu(ctx, "🟢 AI WhatsApp diaktifkan!", [[btnBack("st:view")]]);
    return;
  }
  if (data === "st:wa:off") {
    const { deactivateAI } = require("./core/contacts/master-switch");
    await deactivateAI("telegram");
    await editMenu(ctx, "🔴 AI WhatsApp dimatikan.", [[btnBack("st:view")]]);
    return;
  }
  if (data === "st:wa:p30") {
    const { pauseAI } = require("./core/contacts/master-switch");
    await pauseAI(30);
    await editMenu(ctx, "⏸️ AI WhatsApp dipause 30 menit.", [[btnBack("st:view")]]);
    return;
  }

  // ── MEMORY BROWSER ─────────────────────────────────────
  if (data === "m") {
    await sendMemoryMain(ctx, "edit");
    return;
  }
  const memMatch = data.match(/^m:([a-z]+):(\d+)$/);
  if (memMatch) {
    const [, domain, offsetStr] = memMatch;
    await sendMemoryDomain(ctx, domain, parseInt(offsetStr), "edit");
    return;
  }

  // ── PROYEK ─────────────────────────────────────────────
  const pjPageMatch = data.match(/^pj:(\d+)$/);
  if (pjPageMatch) {
    await sendProyekList(ctx, parseInt(pjPageMatch[1]), "edit");
    return;
  }
  const pjViewMatch = data.match(/^pj:v:(\d+)$/);
  if (pjViewMatch) {
    await sendProyekDetail(ctx, parseInt(pjViewMatch[1]), "edit");
    return;
  }
  const pjUpdateMatch = data.match(/^pj:u:(\d+)$/);
  if (pjUpdateMatch) {
    const idx = parseInt(pjUpdateMatch[1]);
    pendingAction.set(chatId, { action: "proyek_update", idx });
    await editMenu(ctx,
      `✏️ Ketik status baru untuk proyek ini:\n(contoh: aktif, selesai, ditunda, batal)`,
      [[btn("❌ Batal", `pj:v:${idx}`)]]);
    return;
  }
  const pjDeleteMatch = data.match(/^pj:d:(\d+)$/);
  if (pjDeleteMatch) {
    const idx = parseInt(pjDeleteMatch[1]);
    const all = await listProyek();
    const p = all[idx];
    await editMenu(ctx,
      `🗑️ Hapus proyek <b>${p?.nama || p?.name || idx}</b>?\n\nIni tidak bisa dibatalkan.`,
      [[btn("✅ Ya, Hapus", `pj:dc:${idx}`), btn("❌ Batal", `pj:v:${idx}`)]]);
    return;
  }
  const pjDeleteConfirm = data.match(/^pj:dc:(\d+)$/);
  if (pjDeleteConfirm) {
    const idx = parseInt(pjDeleteConfirm[1]);
    try {
      const fsExtra = require("fs-extra");
      const PROJ_FILE = "/root/ai-system/memory/proyek.json";
      const data2 = await fsExtra.readJson(PROJ_FILE).catch(() => ({ entries: [] }));
      const entries = data2.entries || [];
      entries.splice(idx, 1);
      await fsExtra.writeJson(PROJ_FILE, { ...data2, entries }, { spaces: 2 });
      await editMenu(ctx, "✅ Proyek dihapus.", [[btn("🏗️ Kembali ke List", "pj:0")]]);
    } catch (err) {
      await editMenu(ctx, `❌ Gagal hapus: ${err.message}`, [[btnBack("pj:0")]]);
    }
    return;
  }
  const pjRabMatch = data.match(/^pj:rab:(\d+)$/);
  if (pjRabMatch) {
    const idx = parseInt(pjRabMatch[1]);
    const all = await listProyek();
    const p = all[idx];
    await editMenu(ctx, `⏳ Membuat RAB untuk ${p?.nama || p?.name}...`, []);
    try {
      const result = await withTyping(ctx, () => runRAB(p?.nama || p?.name || "proyek"));
      await ctx.reply(result.substring(0, 4000));
    } catch (err) {
      await ctx.reply(`❌ Gagal buat RAB: ${err.message}`);
    }
    return;
  }

  // ── KONTAK WA ──────────────────────────────────────────
  const knPageMatch = data.match(/^kn:(\d+)$/);
  if (knPageMatch) {
    await sendKontakList(ctx, parseInt(knPageMatch[1]), "edit");
    return;
  }
  const knViewMatch = data.match(/^kn:v:(.+)$/);
  if (knViewMatch) {
    await sendKontakDetail(ctx, knViewMatch[1], "edit");
    return;
  }
  const knDelMatch = data.match(/^kn:del:(.+)$/);
  if (knDelMatch) {
    const nomor = knDelMatch[1];
    await editMenu(ctx,
      `🗑️ Hapus kontak <b>${nomor}</b>?`,
      [[btn("✅ Ya, Hapus", `kn:dc:${nomor}`.substring(0,64)), btn("❌ Batal", `kn:v:${nomor}`.substring(0,64))]]);
    return;
  }
  const knDelConfirm = data.match(/^kn:dc:(.+)$/);
  if (knDelConfirm) {
    const nomor = knDelConfirm[1];
    const { removeContact } = require("./core/contacts/contact-manager");
    const ok = await removeContact(nomor);
    await editMenu(ctx,
      ok ? `✅ Kontak ${nomor} dihapus.` : `❌ Kontak tidak ditemukan.`,
      [[btn("👥 Kembali ke List", "kn:0")]]);
    return;
  }
  const knHistMatch = data.match(/^kn:h:(.+)$/);
  if (knHistMatch) {
    const nomor = knHistMatch[1];
    const { getContact } = require("./core/contacts/contact-manager");
    const c = await getContact(nomor);
    const histText = [
      ...(c?.history_proyek || []).map(h => `🏗️ ${h}`),
      ...(c?.history_harga  || []).map(h => `💰 ${h}`)
    ].slice(-10).join("\n") || "(belum ada history)";
    await editMenu(ctx,
      `📋 <b>History: ${c?.nama || nomor}</b>\n━━━━━━━━━━━━━━━━━\n${histText}`,
      [[btnBack(`kn:v:${nomor}`.substring(0,64))]]);
    return;
  }

  // ── DRIVE BROWSER ──────────────────────────────────────
  if (data === "dr:root") {
    await sendDriveFolder(ctx, "root", "edit");
    return;
  }
  const drFolderMatch = data.match(/^dr:f:(.+)$/);
  if (drFolderMatch) {
    await sendDriveFolder(ctx, drFolderMatch[1], "edit");
    return;
  }
  const drFileMatch = data.match(/^dr:fi:(.+)$/);
  if (drFileMatch) {
    const fileId = drFileMatch[1];
    try {
      const { getFileInfo, getDownloadLink } = require("./core/integrations/drive");
      const info = await getFileInfo(fileId);
      const dlLink = getDownloadLink(fileId);
      const text =
`${fileIcon(info.mimeType)} <b>${info.name}</b>
━━━━━━━━━━━━━━━━━
📦 Ukuran: ${formatBytes(info.size)}
📅 Diubah: ${formatDate(info.modifiedTime)}
🔗 <a href="${info.webViewLink || dlLink}">Buka di Drive</a>`;
      await editMenu(ctx, text, [
        [btn("⬇️ Download", `dr:dl:${fileId}`), btn("🗑️ Hapus", `dr:rm:${fileId}`)],
        [btnBack("dr:root"), btnHome()]
      ]);
    } catch (err) {
      await editMenu(ctx, `❌ Gagal baca file: ${err.message}`, [[btnBack("dr:root")]]);
    }
    return;
  }
  const drDlMatch = data.match(/^dr:dl:(.+)$/);
  if (drDlMatch) {
    const fileId = drDlMatch[1];
    const { getDownloadLink } = require("./core/integrations/drive");
    const link = getDownloadLink(fileId);
    await editMenu(ctx,
      `⬇️ <b>Download Link:</b>\n\n<a href="${link}">${link}</a>\n\n<i>Link aktif untuk download langsung.</i>`,
      [[btnBack("dr:root")]]);
    return;
  }
  const drRmMatch = data.match(/^dr:rm:(.+)$/);
  if (drRmMatch) {
    const fileId = drRmMatch[1];
    await editMenu(ctx,
      `🗑️ <b>Hapus file ini?</b>\n\nFile akan dihapus permanen dari Drive.`,
      [[btn("✅ Ya, Hapus", `dr:rm:ok:${fileId}`), btnBack("dr:root")]]);
    return;
  }
  const drRmOkMatch = data.match(/^dr:rm:ok:(.+)$/);
  if (drRmOkMatch) {
    const fileId = drRmOkMatch[1];
    try {
      const { deleteFile } = require("./core/integrations/drive");
      await deleteFile(fileId);
      await editMenu(ctx, "✅ File berhasil dihapus dari Drive.", [[btn("📁 Kembali ke Drive", "dr:root")]]);
    } catch (err) {
      await editMenu(ctx, `❌ Gagal hapus: ${err.message}`, [[btnBack("dr:root")]]);
    }
    return;
  }

  // ── Fallback ────────────────────────────────────────────
  await ctx.answerCbQuery("Memproses...").catch(() => {});
});

// ─── /skill baru [nama]: [deskripsi] ─────────────────────
bot.command("skill", async (ctx) => {
  if (!isAuthorized(ctx.chat.id)) return;
  const args = ctx.message.text.replace("/skill", "").trim();
  if (args.toLowerCase().startsWith("baru ")) {
    const rest = args.replace(/^baru\s+/i, "");
    const colonIdx = rest.indexOf(":");
    if (colonIdx === -1) return ctx.reply("Format: /skill baru [nama]: [deskripsi]");
    const skillName = rest.substring(0, colonIdx).trim().toLowerCase().replace(/\s+/g, "-");
    const deskripsi = rest.substring(colonIdx + 1).trim();
    await ctx.reply(`🔧 Membangun skill /${skillName}...`);
    try {
      const { buildSkill } = require("./core/evolution/skill-builder");
      const result = await buildSkill(skillName, deskripsi);
      await ctx.reply(result);
    } catch (err) {
      await ctx.reply(`❌ Error: ${err.message}`);
    }
    return;
  }
  if (args.toLowerCase() === "list" || args === "") {
    try {
      const { listDynamicSkills } = require("./core/evolution/skill-builder");
      const skills = await listDynamicSkills();
      if (skills.length === 0) return ctx.reply("Belum ada dynamic skill. Buat dengan:\n/skill baru [nama]: [deskripsi]");
      const lines = skills.map(s => `• ${s.command} — ${s.description}`).join("\n");
      return ctx.reply(`📦 Dynamic Skills (${skills.length}):\n\n${lines}`);
    } catch (err) {
      return ctx.reply(`❌ Error: ${err.message}`);
    }
  }
  await ctx.reply("Format:\n/skill list — tampilkan semua skill\n/skill baru [nama]: [deskripsi] — buat skill baru\nContoh: /skill baru cek-besi: analisa kebutuhan besi beton");
});

// ─── /tool baru [nama]: [deskripsi] ──────────────────────
bot.command("tool", async (ctx) => {
  if (!isAuthorized(ctx.chat.id)) return;
  const args = ctx.message.text.replace("/tool", "").trim();
  if (args.toLowerCase().startsWith("baru ")) {
    const rest = args.replace(/^baru\s+/i, "");
    const colonIdx = rest.indexOf(":");
    if (colonIdx === -1) return ctx.reply("Format: /tool baru [nama]: [deskripsi]");
    const toolName = rest.substring(0, colonIdx).trim().toLowerCase().replace(/\s+/g, "-");
    const deskripsi = rest.substring(colonIdx + 1).trim();
    await ctx.reply(`🔧 Membangun tool /${toolName}...`);
    try {
      const { buildTool } = require("./core/evolution/tool-builder");
      const result = await buildTool(toolName, deskripsi);
      await ctx.reply(result);
    } catch (err) {
      await ctx.reply(`❌ Error: ${err.message}`);
    }
    return;
  }
  await ctx.reply("Format: /tool baru [nama]: [deskripsi]");
});

// ─── /knowledge [topik] ──────────────────────────────────
bot.command("knowledge", async (ctx) => {
  if (!isAuthorized(ctx.chat.id)) return;
  await ctx.sendChatAction("typing");
  const topik = ctx.message.text.replace("/knowledge", "").trim();
  try {
    const { getKnowledge } = require("./core/knowledge/ternion-knowledge");
    const result = await getKnowledge(topik || "all");
    await sendLong(ctx, result);
  } catch (err) {
    await ctx.reply(`❌ Knowledge base error: ${err.message}`);
  }
});

// ─── /update [topik] [fakta] ─────────────────────────────
bot.command("update", async (ctx) => {
  if (!isAuthorized(ctx.chat.id)) return;
  const args = ctx.message.text.replace("/update", "").trim();
  const parts = args.split(/\s+/);
  const topik = parts[0];
  const fakta = parts.slice(1).join(" ");
  if (!topik || !fakta) return ctx.reply("Format: /update [topik] [fakta baru]\nContoh: /update konstruksi harga semen Kupang naik ke 65ribu");
  try {
    const { updateKnowledge } = require("./core/knowledge/ternion-knowledge");
    await updateKnowledge(topik, fakta);
    await ctx.reply(`✅ Knowledge [${topik}] diupdate:\n"${fakta}"`);
  } catch (err) {
    await ctx.reply(`❌ Error: ${err.message}`);
  }
});

// ─── Handler feedback follow-up (negative/knowledge) ────
// Ini harus di atas bot.on("text") — TIDAK. Kita intercept di bot.on("text")
// Sudah dihandle di bot.on("text") dengan cek pendingFeedback

// ─── /ai-off, /ai-on, /ai-pause, /ai-status (Telegram) ──
bot.command("ai_off", async (ctx) => {
  if (!isAuthorized(ctx.chat.id)) return;
  const { deactivateAI } = require("./core/contacts/master-switch");
  await deactivateAI("telegram");
  await ctx.reply("🔴 AI WA dimatikan via Telegram.\nKirim /ai_on untuk aktifkan kembali.");
});

bot.command("ai_on", async (ctx) => {
  if (!isAuthorized(ctx.chat.id)) return;
  const { activateAI } = require("./core/contacts/master-switch");
  await activateAI("telegram");
  await ctx.reply("🟢 AI WA diaktifkan kembali.");
});

bot.command("ai_pause", async (ctx) => {
  if (!isAuthorized(ctx.chat.id)) return;
  const args = ctx.message.text.replace("/ai_pause", "").trim();
  const menit = parseInt(args) || 30;
  const { pauseAI } = require("./core/contacts/master-switch");
  await pauseAI(menit);
  await ctx.reply(`🟡 AI WA dipause selama ${menit} menit.\nAktif kembali otomatis setelah itu.`);
});

bot.command("ai_status", async (ctx) => {
  if (!isAuthorized(ctx.chat.id)) return;
  const { getStatus } = require("./core/contacts/master-switch");
  const status = await getStatus();
  await ctx.reply(`🤖 AI WA: ${status}`);
});

// ─── /approve, /reject, /tunda (Approval Workflow) ───────
bot.command("approve", async (ctx) => {
  if (!isAuthorized(ctx.chat.id)) return;
  const args = ctx.message.text.replace("/approve", "").trim().split(/\s+/);
  const id = args[0];
  const detail = args.slice(1).join(" ");
  if (!id) return ctx.reply("Format: /approve [ID] [detail opsional]");
  try {
    const { resolveApproval, getApproveResponse } = require("./core/contacts/approval-workflow");
    const approval = await resolveApproval(id, "approved", null);
    if (!approval) return ctx.reply(`❌ ID ${id} tidak ditemukan.`);
    // Kirim ke WA
    const { client: waClient } = require("./core/integrations/whatsapp");
    try {
      await waClient.sendMessage(`${approval.nomor}@c.us`, getApproveResponse(detail));
    } catch {}
    await ctx.reply(`✅ Approval ${id} dikirimkan ke ${approval.nama}.`);
  } catch (err) {
    await ctx.reply(`❌ Error: ${err.message}`);
  }
});

bot.command("reject", async (ctx) => {
  if (!isAuthorized(ctx.chat.id)) return;
  const args = ctx.message.text.replace("/reject", "").trim().split(/\s+/);
  const id = args[0];
  const alasan = args.slice(1).join(" ");
  if (!id) return ctx.reply("Format: /reject [ID] [alasan]");
  try {
    const { resolveApproval, getRejectResponse } = require("./core/contacts/approval-workflow");
    const approval = await resolveApproval(id, "rejected", alasan);
    if (!approval) return ctx.reply(`❌ ID ${id} tidak ditemukan.`);
    const { client: waClient } = require("./core/integrations/whatsapp");
    try {
      await waClient.sendMessage(`${approval.nomor}@c.us`, getRejectResponse(alasan));
    } catch {}
    await ctx.reply(`✅ Reject ${id} terkirim ke ${approval.nama}.`);
  } catch (err) {
    await ctx.reply(`❌ Error: ${err.message}`);
  }
});

bot.command("tunda", async (ctx) => {
  if (!isAuthorized(ctx.chat.id)) return;
  const id = ctx.message.text.replace("/tunda", "").trim();
  if (!id) return ctx.reply("Format: /tunda [ID]");
  try {
    const { resolveApproval, getTundaResponse } = require("./core/contacts/approval-workflow");
    const approval = await resolveApproval(id, "tunda", null);
    if (!approval) return ctx.reply(`❌ ID ${id} tidak ditemukan.`);
    const { client: waClient } = require("./core/integrations/whatsapp");
    try {
      await waClient.sendMessage(`${approval.nomor}@c.us`, getTundaResponse());
    } catch {}
    await ctx.reply(`✅ Tunda ${id} — sudah dibalas ke ${approval.nama}.`);
  } catch (err) {
    await ctx.reply(`❌ Error: ${err.message}`);
  }
});

// ─── /wa_list, /wa_add via Telegram ───────────────────────
bot.command("wa_list", async (ctx) => {
  if (!isAuthorized(ctx.chat.id)) return;
  try {
    const { listContacts } = require("./core/contacts/contact-manager");
    const list = await listContacts();
    const valid = list.filter(c => !c.nomor.includes("XXXXXXX") && !c.nomor.startsWith("_"));
    if (valid.length === 0) return ctx.reply("Belum ada kontak terdaftar.\nGunakan /wa_add untuk menambah.");
    const text = valid.map((c, i) => `${i + 1}. ${c.nama || c.nomor} — ${c.kategori} (${c.nomor})`).join("\n");
    await ctx.reply(`📋 KONTAK TERDAFTAR:\n\n${text}`);
  } catch (err) {
    await ctx.reply(`❌ Error: ${err.message}`);
  }
});

bot.command("wa_add", async (ctx) => {
  if (!isAuthorized(ctx.chat.id)) return;
  const args = ctx.message.text.replace("/wa_add", "").trim().split(/\s+/);
  if (args.length < 3) return ctx.reply("Format: /wa_add [nomor] [kategori] [nama...]");
  const [nomor, kategori, ...namaArr] = args;
  const nama = namaArr.join(" ");
  try {
    const { addContact } = require("./core/contacts/contact-manager");
    await addContact(nomor, { kategori, nama });
    await ctx.reply(`✅ Kontak ditambahkan:\n📞 ${nomor}\n🏷️ ${kategori}\n👤 ${nama}`);
  } catch (err) {
    await ctx.reply(`❌ Error: ${err.message}`);
  }
});

bot.command("followup", async (ctx) => {
  if (!isAuthorized(ctx.chat.id)) return;
  try {
    const { listFollowUps } = require("./core/contacts/follow-up-engine");
    const list = await listFollowUps("pending");
    if (list.length === 0) return ctx.reply("✅ Tidak ada follow-up pending.");
    const text = list.map((f, i) =>
      `${i + 1}. ${f.nama} — ${f.konteks.substring(0, 60)}\n   Deadline: ${f.deadline} | ID: ${f.id}`
    ).join("\n");
    await ctx.reply(`⏰ FOLLOW-UP PENDING:\n\n${text}`);
  } catch (err) {
    await ctx.reply(`❌ Error: ${err.message}`);
  }
});

bot.launch({ dropPendingUpdates: true }).catch((err) => {
  console.error("[BOT_LAUNCH_ERROR]", err.message);
});

console.log("TERNION-AI TELEGRAM ONLINE");

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));

module.exports = { getConversationCount: () => conversationCountToday };
