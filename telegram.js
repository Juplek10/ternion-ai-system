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
const { analyzeImage, listFoto } = require("./core/tools/image-analyzer");

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

  let aiEngineStatus = "✅ Ternion-AI (active)";
  try {
    const { execSync } = require("child_process");
    execSync("claude --version", { timeout: 5000, stdio: "pipe" });
  } catch { aiEngineStatus = "⚠️ AI Engine standby"; }

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
🤖 AI: ${aiEngineStatus}
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
// PHOTO HANDLER — ANALISA FOTO & DOKUMENTASI
// ═══════════════════════════════════════════════
bot.on("photo", async (ctx) => {
  if (!isAuthorized(ctx.chat.id)) return ctx.reply("Unauthorized.");

  const chatId = ctx.chat.id;
  const caption = ctx.message.caption || "";

  // Ambil foto resolusi tertinggi
  const photos = ctx.message.photo;
  const photo = photos[photos.length - 1];
  const fileId = photo.file_id;

  try {
    await ctx.reply("⏳ Menganalisa foto...");

    const file = await ctx.telegram.getFile(fileId);
    const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${file.file_path}`;
    const uploadDir = path.join(__dirname, "workspace", "uploads");

    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

    const ext = file.file_path.split(".").pop() || "jpg";
    const fileName = `tg_${Date.now()}.${ext}`;
    const uploadPath = path.join(uploadDir, fileName);

    // Download foto
    const response = await axios({ url: fileUrl, method: "GET", responseType: "arraybuffer" });
    fs.writeFileSync(uploadPath, Buffer.from(response.data));

    // Analisa dengan AI vision
    const result = await analyzeImage(uploadPath, caption);

    await ctx.replyWithHTML(result, { disable_web_page_preview: true });

  } catch (err) {
    console.error("[PHOTO] Error:", err.message);
    await ctx.reply(`❌ Gagal analisa foto: ${err.message}`);
  }
});

// ─── Command: /foto ─────────────────────────────────────
bot.command("foto", async (ctx) => {
  if (!isAuthorized(ctx.chat.id)) return ctx.reply("Unauthorized.");

  const args = ctx.message.text.split(" ").slice(1);
  const sub = args[0]?.toLowerCase();

  if (sub === "list") {
    const result = await listFoto();
    return ctx.replyWithHTML(result);
  }

  return ctx.reply(
    "📸 <b>Fitur Foto TERNION-AI</b>\n\n" +
    "Kirim foto langsung ke bot untuk dianalisa.\n\n" +
    "Tambahkan caption untuk konteks:\n" +
    "• Caption \"proyek\" / \"konstruksi\" → analisa progress\n" +
    "• Caption \"material\" / \"mangan\" → identifikasi material\n" +
    "• Caption \"dokumen\" / \"surat\" → OCR & ekstrak info\n\n" +
    "<b>Commands:</b>\n" +
    "/foto list — lihat foto tersimpan\n" +
    "/laporan foto — kompilasi foto proyek",
    { parse_mode: "HTML" }
  );
});

// ─── Command: /laporan foto ─────────────────────────────
bot.command("laporan", async (ctx) => {
  if (!isAuthorized(ctx.chat.id)) return ctx.reply("Unauthorized.");

  const args = ctx.message.text.split(" ").slice(1);
  if (args[0]?.toLowerCase() === "foto") {
    const result = await listFoto(args[1] || null);
    return ctx.replyWithHTML(result);
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

  // ── Intercept pending interactive actions ─────────
  if (pendingAction.has(chatId)) {
    const action = pendingAction.get(chatId);

    // ── WA Kirim: manual nomor ─────────────────────
    if (action.action === "wa_kirim_manual") {
      pendingAction.delete(chatId);
      const nomor = originalText.replace("+", "").replace(/\s/g, "");
      if (!/^\d{8,15}$/.test(nomor)) {
        await ctx.reply("❌ Nomor tidak valid. Kirim nomor tanpa +, contoh: 6281234567890");
        return;
      }
      pendingAction.set(chatId, { action: "wa_kirim_msg", nomor, nama: nomor });
      await ctx.reply(`💬 Ketik pesan untuk nomor +${nomor}:`);
      return;
    }

    // ── WA Kirim: pesan ke kontak ─────────────────
    if (action.action === "wa_kirim_msg") {
      pendingAction.delete(chatId);
      const { nomor, nama } = action;
      pendingAction.set(chatId, { action: "wa_kirim_confirm", nomor, nama, pesan: originalText });
      await sendMenu(ctx,
        `📤 <b>Preview Pesan</b>\n━━━━━━━━━━━━━━━\nKe: <b>${nama}</b>\n\n"${originalText.substring(0, 300)}"`,
        [[btn("✅ Kirim", `wa:ks:${nomor}`), btn("❌ Batal", "wa:k:start")]]
      );
      return;
    }

    // ── WA Broadcast: pesan ke kategori ──────────
    if (action.action === "wa_bc_msg") {
      pendingAction.delete(chatId);
      const { kategori } = action;
      pendingAction.set(chatId, { action: "wa_bc_confirm", kategori, pesan: originalText });
      await sendMenu(ctx,
        `📣 <b>Preview Broadcast</b>\n━━━━━━━━━━━━━━━\nKe: <b>${kategori.toUpperCase()}</b>\n\n"${originalText.substring(0, 300)}"`,
        [[btn("✅ Kirim", "wa:bcs:confirm"), btn("❌ Batal", "wa:bc")]]
      );
      return;
    }

    // ── WA Broadcast: konfirmasi kirim ────────────
    if (action.action === "wa_bc_confirm") {
      // Handled by button callback, ini fallback
      pendingAction.delete(chatId);
    }

    // ── WA Edit field ────────────────────────────
    if (action.action === "wa_edit_field") {
      pendingAction.delete(chatId);
      const { nomor, field } = action;
      const { updateContact } = require("./core/contacts/contact-manager");
      const fieldMap = { nama: "nama", perusahaan: "konteks_bisnis", catatan: "konteks_bisnis" };
      const fieldKey = fieldMap[field] || field;
      await updateContact(nomor, { [fieldKey]: originalText });
      await ctx.reply(`✅ ${field} diupdate untuk +${nomor}:\n"${originalText}"`);
      return;
    }

    // ── Identity Manager: nama kontak ──────────────
    if (action.action === "imr_name") {
      pendingAction.delete(chatId);
      const { nomor } = action;
      const { handleNameInput, buildConfirmKeyboard } = require("./core/contacts/identity-manager");
      const result = await handleNameInput(nomor, originalText);
      if (!result) { await ctx.reply("❌ Error registrasi. Coba lagi."); return; }
      if (typeof result === "string") {
        // Perlu detail tambahan
        pendingAction.set(chatId, { action: "imr_detail", nomor });
        await ctx.reply(result, { parse_mode: "HTML" });
      } else {
        // Langsung ke konfirmasi
        await sendMenu(ctx, result.text, result.keyboard);
      }
      return;
    }

    // ── Identity Manager: detail (perusahaan/dinas/pangkat) ─
    if (action.action === "imr_detail") {
      pendingAction.delete(chatId);
      const { nomor } = action;
      const { handleDetailInput, buildConfirmKeyboard } = require("./core/contacts/identity-manager");
      const result = await handleDetailInput(nomor, originalText);
      if (!result) { await ctx.reply("❌ Error registrasi. Coba lagi."); return; }
      await sendMenu(ctx, result.text, result.keyboard);
      return;
    }

    // ── Approval: manual reply ────────────────────
    if (action.action === "apv_reply") {
      pendingAction.delete(chatId);
      const { nomor, nama, id } = action;
      const { resolveApproval } = require("./core/contacts/approval-workflow");
      try {
        const { client: waClient } = require("./core/integrations/whatsapp");
        await waClient.sendMessage(`${nomor}@c.us`, originalText);
        await resolveApproval(id, "replied", "manual reply");
        await ctx.reply(`✅ Balasan dikirim ke ${nama}.`);
      } catch (err) {
        await ctx.reply(`❌ Gagal kirim: ${err.message}`);
      }
      return;
    }

    // ── Template baru ─────────────────────────────
    if (action.action === "wa_tmpl_new") {
      pendingAction.delete(chatId);
      const parts = originalText.split("|");
      if (parts.length < 2) {
        await ctx.reply("❌ Format: nama|teks\nContoh: Terima kasih|Terima kasih atas pesanannya!");
        return;
      }
      const { addTemplate } = require("./core/contacts/contact-templates");
      const id = await addTemplate(parts[0].trim(), parts.slice(1).join("|").trim());
      await ctx.reply(`✅ Template "${parts[0].trim()}" tersimpan dengan ID: ${id}`);
      return;
    }

    // ── Proyek update ─────────────────────────────
    if (action.action === "proyek_update") {
      pendingAction.delete(chatId);
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
`📱 <b>WHATSAPP CONTROL CENTER</b>
━━━━━━━━━━━━━━━━━
/wa — Menu utama WA Control
/wa_kirim — Kirim pesan WA
/wa_terbaru — Chat terbaru
/wa_direktori — Direktori kontak
/wa_broadcast — Broadcast pesan
/wa_edit — Edit data kontak
/wa_template — Template pesan
/wa_status — Dashboard WA
/wa_export — Export ke Drive`,
      [[btn("📱 Buka WA Control", "wa:m"), btnBack("h")], [btnHome()]]);
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

  // ── WA Kirim Send Execute ─────────────────────────────────
  const waKsSendMatch = data.match(/^wa:ks:(\d{8,15})$/);
  if (waKsSendMatch) {
    const nomor = waKsSendMatch[1];
    // Ambil pesan dari pendingAction jika ada
    const stored = pendingAction.get(chatId);
    if (stored && stored.action === "wa_kirim_confirm" && stored.nomor === nomor) {
      pendingAction.delete(chatId);
      const { sendToContact } = require("./core/wa-control/wa-controller");
      try {
        await sendToContact(nomor, stored.pesan);
        await editMenu(ctx, `✅ Pesan terkirim ke <b>${stored.nama}</b>!`, [[btn("📱 WA Menu", "wa:m")]]);
      } catch (err) {
        await editMenu(ctx, `❌ Gagal kirim: ${err.message}`, [[btnBack("wa:k:start")]]);
      }
    } else {
      await editMenu(ctx, "❌ Pesan tidak ditemukan. Mulai ulang.", [[btn("💬 Kirim Pesan", "wa:k:start")]]);
    }
    return;
  }

  // ── WA Broadcast Send ────────────────────────────────────
  if (data === "wa:bcs:confirm") {
    const stored = pendingAction.get(chatId);
    if (stored && stored.action === "wa_bc_confirm") {
      pendingAction.delete(chatId);
      const { broadcastToCategory } = require("./core/wa-control/wa-controller");
      await editMenu(ctx, `📣 Mengirim broadcast ke <b>${stored.kategori}</b>...`, []);
      try {
        const result = await broadcastToCategory(stored.kategori, stored.pesan);
        await ctx.reply(
          `✅ Broadcast selesai!\n✅ Terkirim: ${result.sent.length} kontak\n❌ Gagal: ${result.failed.length} kontak` +
          (result.failed.length > 0 ? `\nGagal: ${result.failed.join(", ")}` : "")
        );
      } catch (err) {
        await ctx.reply(`❌ Broadcast gagal: ${err.message}`);
      }
    }
    return;
  }

  // ── WA CONTROL CENTER ──────────────────────────────────────
  if (data === "wa:m") { await sendWAMenu(ctx, "edit"); return; }
  if (data === "wa:k:start") { await startWAKirimMenu(ctx, "edit"); return; }
  if (data === "wa:bc") { await sendWABroadcastMenu(ctx, "edit"); return; }
  if (data === "wa:tb") { await ctx.sendChatAction("typing").catch(()=>{}); await showWATerbaru(ctx, "edit"); return; }
  if (data === "wa:dir") { await sendWADirektori(ctx, "edit"); return; }
  if (data === "wa:tmpl") { await sendWATemplateMenu(ctx, "edit"); return; }
  if (data === "wa:st") { await ctx.sendChatAction("typing").catch(()=>{}); await showWAStatus(ctx, "edit"); return; }
  if (data === "wa:ed:start") { await showWAEditMenu(ctx, "edit"); return; }

  // WA kirim ke kontak
  if (data === "wa:k:manual") {
    pendingAction.set(chatId, { action: "wa_kirim_manual" });
    await editMenu(ctx, "✏️ Ketik nomor WA tujuan:\n(contoh: 6281234567890)", [[btn("❌ Batal", "wa:k:start")]]);
    return;
  }

  const waKirimMatch = data.match(/^wa:k:(\d{8,15})$/);
  if (waKirimMatch) {
    const nomor = waKirimMatch[1];
    const { getContact } = require("./core/contacts/contact-manager");
    const c = await getContact(nomor).catch(() => null);
    const nama = c?.nama || nomor;
    pendingAction.set(chatId, { action: "wa_kirim_msg", nomor, nama });
    await editMenu(ctx, `💬 Ketik pesan untuk <b>${nama}</b>:`, [[btn("❌ Batal", "wa:k:start")]]);
    return;
  }

  const waKirimConfirm = data.match(/^wa:kc:(.+)$/);
  if (waKirimConfirm) {
    const [nomor, ...pesanParts] = waKirimConfirm[1].split(":");
    // Handled via pendingAction flow
    return;
  }

  // WA chat history
  const waChMatch = data.match(/^wa:ch:(\d{8,15})$/);
  if (waChMatch) {
    const nomor = waChMatch[1];
    await showWAChatHistory(ctx, nomor, "edit");
    return;
  }

  // WA directory by category
  const waDirCatMatch = data.match(/^wa:dir:(.+)$/);
  if (waDirCatMatch) {
    const kategori = waDirCatMatch[1];
    const { listContacts } = require("./core/contacts/contact-manager");
    const all = (await listContacts(kategori)).filter(c => !c.nomor.includes("XXXXXXX") && !c.nomor.startsWith("_"));
    const icon = CAT_ICONS_WA[kategori] || "👤";
    const text = `${icon} <b>DIREKTORI: ${kategori.toUpperCase()}</b>\n━━━━━━━━━━━━━━━━━\n${all.length} kontak`;
    const rows = all.slice(0, 20).map(c => {
      const label = `${icon} ${(c.nama || c.nomor).substring(0, 28)}`;
      return [btn(label, `wa:dc:${c.nomor}`.substring(0, 64))];
    });
    rows.push([btnBack("wa:dir")]);
    await editMenu(ctx, text, rows);
    return;
  }

  // WA directory contact detail
  const waDcMatch = data.match(/^wa:dc:(\d{8,15})$/);
  if (waDcMatch) {
    await sendKontakDetail(ctx, waDcMatch[1], "edit");
    return;
  }

  // WA edit contact detail
  const waEdMatch = data.match(/^wa:ed:(\d{8,15})$/);
  if (waEdMatch) {
    await showWAEditDetail(ctx, waEdMatch[1]);
    return;
  }

  // WA edit field
  const waEfMatch = data.match(/^wa:ef:(\d{8,15}):(.+)$/);
  if (waEfMatch) {
    const [, nomor, field] = waEfMatch;
    const { getContact } = require("./core/contacts/contact-manager");
    const c = await getContact(nomor).catch(() => null);
    const nama = c?.nama || nomor;
    const fieldLabels = { nama: "nama", perusahaan: "perusahaan/konteks", catatan: "catatan" };
    pendingAction.set(chatId, { action: "wa_edit_field", nomor, field });
    await editMenu(ctx,
      `✏️ Ketik ${fieldLabels[field] || field} baru untuk <b>${nama}</b>:`,
      [[btn("❌ Batal", `wa:ed:${nomor}`.substring(0, 64))]]);
    return;
  }

  // WA edit posisi
  const waEpMatch = data.match(/^wa:ep:(\d{8,15})$/);
  if (waEpMatch) {
    const nomor = waEpMatch[1];
    const { buildCategoryKeyboard } = require("./core/contacts/identity-manager");
    await editMenu(ctx,
      `🏷️ Pilih posisi baru:`,
      buildCategoryKeyboard(nomor).map(row => row.map(b => ({
        ...b,
        callback_data: b.callback_data.replace("imr:cat:", "wa:epc:").substring(0, 64)
      })))
    );
    return;
  }

  // WA edit posisi confirm
  const waEpcMatch = data.match(/^wa:epc:(\d{8,15}):(.+)$/);
  if (waEpcMatch) {
    const [, nomor, katKey] = waEpcMatch;
    const { KATEGORI_MAP } = require("./core/contacts/identity-manager");
    const { updateContact } = require("./core/contacts/contact-manager");
    const katInfo = KATEGORI_MAP[katKey];
    if (katInfo) {
      await updateContact(nomor, { kategori: katInfo.kategori, sub_kategori: katInfo.sub || null });
      await editMenu(ctx, `✅ Posisi diupdate ke <b>${katInfo.label}</b>.\nAI akan sesuaikan gaya respons.`,
        [[btn("⬅️ Kembali", `wa:ed:${nomor}`.substring(0, 64))]]);
    }
    return;
  }

  // WA broadcast category
  const waBcCatMatch = data.match(/^wa:bc:(.+)$/);
  if (waBcCatMatch) {
    const kategori = waBcCatMatch[1];
    if (kategori === "manual") {
      pendingAction.set(chatId, { action: "wa_bc_manual" });
      await editMenu(ctx, "✏️ Ketik pesan broadcast:\n(akan dikirim ke semua kontak manual)", [[btn("❌ Batal", "wa:bc")]]);
      return;
    }
    pendingAction.set(chatId, { action: "wa_bc_msg", kategori });
    await editMenu(ctx, `📣 Ketik pesan untuk <b>${kategori}</b>:`, [[btn("❌ Batal", "wa:bc")]]);
    return;
  }

  // WA template select
  const waTmplMatch = data.match(/^wa:tmpl:(.+)$/);
  if (waTmplMatch) {
    const tmplId = waTmplMatch[1];
    if (tmplId === "new") {
      pendingAction.set(chatId, { action: "wa_tmpl_new" });
      await editMenu(ctx, "📝 Ketik template baru (format: nama|teks):\nContoh: Terima kasih|Terima kasih atas pesanannya!", [[btn("❌ Batal", "wa:tmpl")]]);
      return;
    }
    const { getTemplate } = require("./core/contacts/contact-templates");
    const tmpl = await getTemplate(tmplId);
    if (!tmpl) { await editMenu(ctx, "❌ Template tidak ditemukan.", [[btnBack("wa:tmpl")]]); return; }
    // Tampil template + pilih kontak untuk kirim
    const { getContactList } = require("./core/wa-control/wa-controller");
    const contacts = await getContactList().catch(() => []);
    const text = `📝 <b>${tmpl.icon} ${tmpl.nama}</b>\n━━━━━━━━━━━━━━━\n"${tmpl.teks.substring(0, 200)}"\n\nKirim ke:`;
    const rows = contacts.slice(0, 15).map(c => {
      const icon = CAT_ICONS_WA[c.kategori] || "👤";
      return [btn(`${icon} ${(c.nama || c.nomor).substring(0, 28)}`, `wa:tsc:${c.nomor}:${tmplId}`.substring(0, 64))];
    });
    rows.push([btnBack("wa:tmpl")]);
    await editMenu(ctx, text, rows);
    return;
  }

  // WA template send confirm
  const waTscMatch = data.match(/^wa:tsc:(\d{8,15}):(.+)$/);
  if (waTscMatch) {
    const [, nomor, tmplId] = waTscMatch;
    const { getTemplate } = require("./core/contacts/contact-templates");
    const { getContact } = require("./core/contacts/contact-manager");
    const [tmpl, kontak] = await Promise.all([getTemplate(tmplId), getContact(nomor)]);
    if (!tmpl) { await editMenu(ctx, "❌ Template tidak ditemukan.", [[btnBack("wa:tmpl")]]); return; }
    const nama = kontak?.nama || nomor;
    const teks = tmpl.teks.replace(/\[nama\]/gi, nama);
    await editMenu(ctx,
      `📤 <b>Konfirmasi Kirim</b>\n━━━━━━━━━━━━━━━\nKe: <b>${nama}</b>\n\n"${teks}"`,
      [[btn("✅ Kirim", `wa:tss:${nomor}:${tmplId}`.substring(0, 64)), btn("❌ Batal", "wa:tmpl")]]
    );
    return;
  }

  // WA template send execute
  const waTssMatch = data.match(/^wa:tss:(\d{8,15}):(.+)$/);
  if (waTssMatch) {
    const [, nomor, tmplId] = waTssMatch;
    const { getTemplate } = require("./core/contacts/contact-templates");
    const { getContact } = require("./core/contacts/contact-manager");
    const { sendToContact } = require("./core/wa-control/wa-controller");
    const [tmpl, kontak] = await Promise.all([getTemplate(tmplId), getContact(nomor)]);
    const nama = kontak?.nama || nomor;
    const teks = tmpl.teks.replace(/\[nama\]/gi, nama);
    try {
      await sendToContact(nomor, teks);
      await editMenu(ctx, `✅ Template "${tmpl.nama}" terkirim ke <b>${nama}</b>!`, [[btnBack("wa:tmpl")]]);
    } catch (err) {
      await editMenu(ctx, `❌ Gagal kirim: ${err.message}`, [[btnBack("wa:tmpl")]]);
    }
    return;
  }

  // WA approval list
  if (data === "wa:apv") {
    const { listPendingApprovals } = require("./core/contacts/approval-workflow");
    const list = await listPendingApprovals();
    if (list.length === 0) {
      await editMenu(ctx, "✅ Tidak ada approval pending.", [[btnBack("wa:st")]]);
      return;
    }
    const text = `📋 <b>APPROVAL PENDING</b>\n━━━━━━━━━━━━━━━\n` +
      list.map((a, i) => `${i+1}. ${a.nama} — ${a.konteks.substring(0,60)}\nID: ${a.id}`).join("\n\n");
    await editMenu(ctx, text, [[btnBack("wa:st")]]);
    return;
  }

  // WA follow-up list
  if (data === "wa:fu") {
    const { listFollowUps } = require("./core/contacts/follow-up-engine");
    const list = await listFollowUps("pending");
    if (list.length === 0) {
      await editMenu(ctx, "✅ Tidak ada follow-up pending.", [[btnBack("wa:st")]]);
      return;
    }
    const text = `⏰ <b>FOLLOW-UP PENDING</b>\n━━━━━━━━━━━━━━━\n` +
      list.map((f, i) => `${i+1}. ${f.nama} — ${f.konteks.substring(0,60)}\nDeadline: ${f.deadline}`).join("\n\n");
    await editMenu(ctx, text, [[btnBack("wa:st")]]);
    return;
  }

  // ── IDENTITY MANAGER CALLBACKS ─────────────────────────
  const imrCatMatch = data.match(/^imr:cat:(\d{8,15}):(.+)$/);
  if (imrCatMatch) {
    const [, nomor, katKey] = imrCatMatch;
    const { handleCategorySelected } = require("./core/contacts/identity-manager");
    const result = await handleCategorySelected(nomor, katKey);
    if (!result) { await editMenu(ctx, "❌ Error registrasi.", []); return; }
    pendingAction.set(chatId, { action: "imr_name", nomor });
    await editMenu(ctx, result, [[btn("❌ Batal", `imr:skip:${nomor}`)]]);
    return;
  }

  const imrSkipMatch = data.match(/^imr:skip:(\d{8,15})$/);
  if (imrSkipMatch) {
    const nomor = imrSkipMatch[1];
    const { skipRegistration } = require("./core/contacts/identity-manager");
    await skipRegistration(nomor);
    await editMenu(ctx, `⏭️ Registrasi kontak +${nomor} dilewati.`, [[btn("📱 WA Menu", "wa:m")]]);
    return;
  }

  const imrConfirmMatch = data.match(/^imr:confirm:(\d{8,15})$/);
  if (imrConfirmMatch) {
    const nomor = imrConfirmMatch[1];
    const { confirmRegistration } = require("./core/contacts/identity-manager");
    const result = await confirmRegistration(nomor);
    await editMenu(ctx, result || "✅ Kontak disimpan.", [[btn("📱 WA Menu", "wa:m")]]);
    return;
  }

  const imrEditMatch = data.match(/^imr:edit:(\d{8,15})$/);
  if (imrEditMatch) {
    const nomor = imrEditMatch[1];
    const { resetToCategory, buildCategoryKeyboard } = require("./core/contacts/identity-manager");
    await resetToCategory(nomor);
    await editMenu(ctx, `🔄 <b>Pilih posisi ulang:</b>`, buildCategoryKeyboard(nomor));
    return;
  }

  // ── APPROVAL WORKFLOW INLINE BUTTONS ──────────────────
  const apvOkMatch = data.match(/^apv:ok:(.+)$/);
  if (apvOkMatch) {
    const id = apvOkMatch[1];
    if (id.startsWith("c:")) {
      // Confirm approve
      const realId = id.substring(2);
      const { resolveApproval, getApproveResponse } = require("./core/contacts/approval-workflow");
      const approval = await resolveApproval(realId, "approved", null);
      if (!approval) { await editMenu(ctx, "❌ ID tidak ditemukan.", []); return; }
      try {
        const { client: waClient } = require("./core/integrations/whatsapp");
        await waClient.sendMessage(`${approval.nomor}@c.us`, getApproveResponse());
      } catch {}
      await editMenu(ctx, `✅ Disetujui dan dikonfirmasi ke ${approval.nama}.`, []);
      return;
    }
    await editMenu(ctx, `✅ <b>Konfirmasi Setuju?</b>`, [
      [btn("✅ Ya, Setuju", `apv:ok:c:${id}`.substring(0, 64)), btn("❌ Batal", `wa:st`)]
    ]);
    return;
  }

  const apvRejMatch = data.match(/^apv:rej:(.+)$/);
  if (apvRejMatch) {
    const id = apvRejMatch[1];
    if (id.startsWith("s:")) {
      const realId = id.substring(2);
      const { resolveApproval, getRejectResponse } = require("./core/contacts/approval-workflow");
      const approval = await resolveApproval(realId, "rejected", null);
      if (!approval) { await editMenu(ctx, "❌ ID tidak ditemukan.", []); return; }
      try {
        const { client: waClient } = require("./core/integrations/whatsapp");
        await waClient.sendMessage(`${approval.nomor}@c.us`, getRejectResponse(null));
      } catch {}
      await editMenu(ctx, `❌ Ditolak, balasan dikirim ke ${approval.nama}.`, []);
      return;
    }
    await editMenu(ctx,
      `❌ <b>Tolak permintaan ini?</b>`,
      [[btn("Kirim tanpa alasan", `apv:rej:s:${id}`.substring(0, 64)),
        btn("Ketik alasan", `apv:rply:${id}`.substring(0, 64))],
       [btn("❌ Batal", "wa:st")]]
    );
    return;
  }

  const apvTndMatch = data.match(/^apv:tnd:(.+)$/);
  if (apvTndMatch) {
    const id = apvTndMatch[1];
    const { resolveApproval, getTundaResponse } = require("./core/contacts/approval-workflow");
    const approval = await resolveApproval(id, "tunda", null);
    if (!approval) { await editMenu(ctx, "❌ ID tidak ditemukan.", []); return; }
    try {
      const { client: waClient } = require("./core/integrations/whatsapp");
      await waClient.sendMessage(`${approval.nomor}@c.us`, getTundaResponse());
    } catch {}
    await editMenu(ctx, `⏸️ Ditunda, balasan dikirim ke ${approval.nama}.`, []);
    return;
  }

  const apvRplyMatch = data.match(/^apv:rply:(.+)$/);
  if (apvRplyMatch) {
    const id = apvRplyMatch[1];
    const { getApproval } = require("./core/contacts/approval-workflow");
    const approval = await getApproval(id);
    if (!approval) { await editMenu(ctx, "❌ ID tidak ditemukan.", []); return; }
    pendingAction.set(chatId, { action: "apv_reply", id, nomor: approval.nomor, nama: approval.nama });
    await editMenu(ctx,
      `💬 Ketik balasan manual untuk <b>${approval.nama}</b>:`,
      [[btn("❌ Batal", "wa:st")]]
    );
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

// ═══════════════════════════════════════════════════════════
// WA CONTROL CENTER — Semua command /wa_*
// ═══════════════════════════════════════════════════════════

const CAT_ICONS_WA = {
  nexus: "👑", internal: "🏢", kontraktor: "🏗️", supplier: "🚛",
  pengepul: "⛏️", relasi: "🤝", pemerintah: "🏛️", tidak_dikenal: "❓"
};

// ─── /wa → Menu utama WA Control ──────────────────────────
bot.command("wa", async (ctx) => {
  if (!isAuthorized(ctx.chat.id)) return;
  await sendWAMenu(ctx, "send");
});

async function sendWAMenu(ctx, mode = "send") {
  const text =
`📱 <b>WHATSAPP CONTROL CENTER</b>
━━━━━━━━━━━━━━━━━━━━━━━━
Kelola WhatsApp TERNION via Telegram:`;

  const rows = [
    [btn("📋 Direktori", "wa:dir"),      btn("💬 Kirim Pesan", "wa:k:start")],
    [btn("📊 Chat Terbaru", "wa:tb"),    btn("📣 Broadcast", "wa:bc")],
    [btn("✏️ Edit Kontak", "wa:ed:start"), btn("📝 Template", "wa:tmpl")],
    [btn("📊 Status WA", "wa:st"),       btn("📤 Export", "wa:exp")],
    [btn("🟢 AI On", "st:wa:on"),        btn("🔴 AI Off", "st:wa:off")]
  ];
  if (mode === "edit") await editMenu(ctx, text, rows);
  else await sendMenu(ctx, text, rows);
}

// ─── /wa_kirim → Mulai flow kirim pesan ───────────────────
bot.command("wa_kirim", async (ctx) => {
  if (!isAuthorized(ctx.chat.id)) return;
  await startWAKirimMenu(ctx, "send");
});

async function startWAKirimMenu(ctx, mode = "send") {
  const { getContactList } = require("./core/wa-control/wa-controller");
  let contacts = [];
  try { contacts = await getContactList(); } catch {}
  const valid = contacts.filter(c => c.kategori !== "tidak_dikenal").slice(0, 20);

  const text = `💬 <b>KIRIM PESAN WA</b>\n━━━━━━━━━━━━━━━━━\nPilih kontak tujuan:`;
  const rows = valid.map(c => {
    const icon = CAT_ICONS_WA[c.kategori] || "👤";
    const label = `${icon} ${(c.nama || c.nomor).substring(0, 22)} (${c.kategori})`;
    return [btn(label, `wa:k:${c.nomor}`.substring(0, 64))];
  });
  rows.push([btn("✏️ Ketik Nomor Manual", "wa:k:manual"), btnBack("wa:m")]);

  if (mode === "edit") await editMenu(ctx, text, rows);
  else await sendMenu(ctx, text, rows);
}

// ─── /wa_broadcast ─────────────────────────────────────────
bot.command("wa_broadcast", async (ctx) => {
  if (!isAuthorized(ctx.chat.id)) return;
  await sendWABroadcastMenu(ctx, "send");
});

async function sendWABroadcastMenu(ctx, mode = "send") {
  const text = `📣 <b>BROADCAST PESAN WA</b>\n━━━━━━━━━━━━━━━━━\nKirim ke kategori:`;
  const rows = [
    [btn("👥 Semua Internal", "wa:bc:internal"),   btn("🏗️ Kontraktor", "wa:bc:kontraktor")],
    [btn("🚛 Supplier",       "wa:bc:supplier"),    btn("⛏️ Pengepul", "wa:bc:pengepul")],
    [btn("🤝 Relasi",         "wa:bc:relasi"),      btn("🏛️ Pemerintah", "wa:bc:pemerintah")],
    [btn("✏️ Pilih Manual",   "wa:bc:manual"),      btnBack("wa:m")]
  ];
  if (mode === "edit") await editMenu(ctx, text, rows);
  else await sendMenu(ctx, text, rows);
}

// ─── /wa_chat [nomor/nama] → history chat ─────────────────
bot.command("wa_chat", async (ctx) => {
  if (!isAuthorized(ctx.chat.id)) return;
  const args = ctx.message.text.replace("/wa_chat", "").trim();
  if (!args) {
    await ctx.reply("Format: /wa_chat [nomor]\nContoh: /wa_chat 6281234567890");
    return;
  }
  const nomor = args.replace("+", "").replace(/\s/g, "");
  await showWAChatHistory(ctx, nomor, "send");
});

async function showWAChatHistory(ctx, nomor, mode = "edit") {
  const { getMessages } = require("./core/wa-control/wa-controller");
  const { getContact } = require("./core/contacts/contact-manager");
  const kontak = await getContact(nomor).catch(() => null);
  const nama = kontak?.nama || nomor;

  await (mode === "edit"
    ? editMenu(ctx, `⏳ Memuat chat ${nama}...`, [])
    : ctx.reply(`⏳ Memuat chat ${nama}...`));

  const messages = await getMessages(nomor, 10).catch(() => []);

  if (messages.length === 0) {
    await editMenu(ctx, `💬 <b>Chat: ${nama}</b>\n\nBelum ada pesan.`,
      [[btn("⬅️ Kembali", "wa:tb"), btn("💬 Kirim", `wa:k:${nomor}`.substring(0, 64))]]);
    return;
  }

  const lines = messages.map(m =>
    `${m.timeStr} ${m.fromMe ? "🤖" : "👤"}: ${(m.body || "").substring(0, 100)}`
  ).join("\n");

  const text =
    `💬 <b>CHAT DENGAN ${nama.toUpperCase()}</b>\n` +
    `━━━━━━━━━━━━━━━━━━\n${lines}`;

  await editMenu(ctx, text, [
    [btn("💬 Balas", `wa:k:${nomor}`.substring(0, 64)), btn("⬅️ Kembali", "wa:tb")]
  ]);
}

// ─── /wa_terbaru → 10 chat terbaru ─────────────────────────
bot.command("wa_terbaru", async (ctx) => {
  if (!isAuthorized(ctx.chat.id)) return;
  await ctx.sendChatAction("typing");
  await showWATerbaru(ctx, "send");
});

async function showWATerbaru(ctx, mode = "send") {
  const { getRecentChats } = require("./core/wa-control/wa-controller");
  const chats = await getRecentChats(10).catch(() => []);

  const text = `📊 <b>CHAT TERBARU</b>\n━━━━━━━━━━━━━━━━━`;
  if (chats.length === 0) {
    const noChat = text + "\n\nBelum ada chat atau WA belum terhubung.";
    if (mode === "edit") await editMenu(ctx, noChat, [[btnBack("wa:m")]]);
    else await sendMenu(ctx, noChat, [[btnBack("wa:m")]]);
    return;
  }

  const rows = chats.map(c => {
    const icon = CAT_ICONS_WA[c.kategori] || "👤";
    const label = `${icon} ${c.name.substring(0, 18)} — ${c.lastMessage.substring(0, 20)} (${c.timeStr})`;
    return [btn(label, `wa:ch:${c.nomor}`.substring(0, 64))];
  });
  rows.push([btn("🔄 Refresh", "wa:tb"), btnBack("wa:m")]);

  if (mode === "edit") await editMenu(ctx, text, rows);
  else await sendMenu(ctx, text, rows);
}

// ─── /wa_edit → Edit kontak ────────────────────────────────
bot.command("wa_edit", async (ctx) => {
  if (!isAuthorized(ctx.chat.id)) return;
  await showWAEditMenu(ctx, "send");
});

async function showWAEditMenu(ctx, mode = "send") {
  const { listContacts } = require("./core/contacts/contact-manager");
  const all = (await listContacts()).filter(c => !c.nomor.includes("XXXXXXX") && !c.nomor.startsWith("_"));
  const text = `✏️ <b>EDIT KONTAK WA</b>\n━━━━━━━━━━━━━━━━━\nPilih kontak:`;
  const rows = all.slice(0, 20).map(c => {
    const icon = CAT_ICONS_WA[c.kategori] || "👤";
    return [btn(`${icon} ${(c.nama || c.nomor).substring(0, 25)} — ${c.kategori}`, `wa:ed:${c.nomor}`.substring(0, 64))];
  });
  rows.push([btnBack("wa:m")]);
  if (mode === "edit") await editMenu(ctx, text, rows);
  else await sendMenu(ctx, text, rows);
}

async function showWAEditDetail(ctx, nomor) {
  const { getContact } = require("./core/contacts/contact-manager");
  const c = await getContact(nomor);
  if (!c) { await editMenu(ctx, "❌ Kontak tidak ditemukan.", [[btnBack("wa:ed:start")]]); return; }
  const icon = CAT_ICONS_WA[c.kategori] || "👤";
  const text =
    `📋 <b>DETAIL KONTAK</b>\n━━━━━━━━━━━━━━\n` +
    `${icon} Nama: <b>${c.nama || "(belum ada)"}</b>\n` +
    `📱 Nomor: +${c.nomor}\n` +
    `🏷️ Posisi: ${c.kategori}${c.sub_kategori ? "/" + c.sub_kategori : ""}\n` +
    `🏢 Perusahaan: ${c.konteks_bisnis || "—"}\n` +
    `💬 Interaksi: ${c.total_interactions || 0}x\n` +
    `📅 Terakhir: ${c.last_interaction ? c.last_interaction.split("T")[0] : "belum"}`;

  const n = nomor.substring(0, 13);
  await editMenu(ctx, text, [
    [btn("✏️ Ganti Nama",    `wa:ef:${n}:nama`),      btn("🏷️ Ganti Posisi",   `wa:ep:${n}`)],
    [btn("🏢 Edit Perusahaan",`wa:ef:${n}:perusahaan`),btn("📝 Tambah Catatan", `wa:ef:${n}:catatan`)],
    [btn("🗑️ Hapus Kontak",  `kn:del:${n}`),          btnBack("wa:ed:start")]
  ]);
}

// ─── /wa_direktori → Direktori kontak ─────────────────────
bot.command("wa_direktori", async (ctx) => {
  if (!isAuthorized(ctx.chat.id)) return;
  await sendWADirektori(ctx, "send");
});

async function sendWADirektori(ctx, mode = "send") {
  const { listContacts } = require("./core/contacts/contact-manager");
  const all = await listContacts();
  const counts = {};
  for (const c of all) {
    if (c.nomor.includes("XXXXXXX") || c.nomor.startsWith("_")) continue;
    counts[c.kategori] = (counts[c.kategori] || 0) + 1;
  }

  const text =
    `📱 <b>DIREKTORI TERNION</b>\n` +
    `━━━━━━━━━━━━━━━━━━\n` +
    `Total: ${Object.values(counts).reduce((a, b) => a + b, 0)} kontak`;

  const rows = [
    [btn(`🔺 Ternion (${counts.nexus || 0})`,        "wa:dir:nexus"),
     btn(`🏢 Internal (${counts.internal || 0})`,    "wa:dir:internal")],
    [btn(`🏗️ Kontraktor (${counts.kontraktor || 0})`, "wa:dir:kontraktor"),
     btn(`🚛 Supplier (${counts.supplier || 0})`,    "wa:dir:supplier")],
    [btn(`⛏️ Pengepul (${counts.pengepul || 0})`,    "wa:dir:pengepul"),
     btn(`🤝 Relasi (${counts.relasi || 0})`,        "wa:dir:relasi")],
    [btn(`🏛️ Pemerintah (${counts.pemerintah || 0})`, "wa:dir:pemerintah"),
     btn(`❓ Belum terdaftar (${counts.tidak_dikenal || 0})`, "wa:dir:tidak_dikenal")],
    [btnHome()]
  ];

  if (mode === "edit") await editMenu(ctx, text, rows);
  else await sendMenu(ctx, text, rows);
}

// ─── /wa_template → Quick reply templates ─────────────────
bot.command("wa_template", async (ctx) => {
  if (!isAuthorized(ctx.chat.id)) return;
  await sendWATemplateMenu(ctx, "send");
});

async function sendWATemplateMenu(ctx, mode = "send") {
  const { getTemplates } = require("./core/contacts/contact-templates");
  const templates = await getTemplates();
  const text = `📝 <b>TEMPLATE PESAN</b>\n━━━━━━━━━━━━━━━\nPilih template:`;
  const rows = templates.map(t => [btn(`${t.icon} ${t.nama}`, `wa:tmpl:${t.id}`)]);
  rows.push([btn("✏️ Buat Template Baru", "wa:tmpl:new"), btnBack("wa:m")]);
  if (mode === "edit") await editMenu(ctx, text, rows);
  else await sendMenu(ctx, text, rows);
}

// ─── /wa_status → Dashboard status WA ─────────────────────
bot.command("wa_status", async (ctx) => {
  if (!isAuthorized(ctx.chat.id)) return;
  await ctx.sendChatAction("typing");
  await showWAStatus(ctx, "send");
});

async function showWAStatus(ctx, mode = "send") {
  const { getStatus: getWAStatus } = require("./core/contacts/master-switch");
  const { listContacts } = require("./core/contacts/contact-manager");
  const { listFollowUps } = require("./core/contacts/follow-up-engine");
  const { listPendingApprovals } = require("./core/contacts/approval-workflow");
  const { isClientReady } = require("./core/wa-control/wa-controller");

  const [waStatus, allContacts, followups, approvals, waReady] = await Promise.all([
    getWAStatus().catch(() => "❓"),
    listContacts().catch(() => []),
    listFollowUps("pending").catch(() => []),
    listPendingApprovals().catch(() => []),
    isClientReady().catch(() => false)
  ]);

  const valid = allContacts.filter(c => !c.nomor.includes("XXXXXXX") && !c.nomor.startsWith("_"));
  const belumDaftar = valid.filter(c => c.kategori === "tidak_dikenal").length;
  const terdaftar = valid.length - belumDaftar;

  const text =
    `📱 <b>WHATSAPP STATUS</b>\n` +
    `━━━━━━━━━━━━━━━━━\n` +
    `🤖 AI WA: ${waStatus}\n` +
    `📡 Koneksi WA: ${waReady ? "🟢 Terhubung" : "🔴 Tidak terhubung"}\n` +
    `👥 Kontak terdaftar: ${terdaftar}\n` +
    `❓ Belum terdaftar: ${belumDaftar}\n` +
    `📋 Approval pending: ${approvals.length}\n` +
    `⏰ Follow-up pending: ${followups.length}`;

  const rows = [
    [btn("📋 Lihat Approval",  "wa:apv"),    btn("⏰ Follow-up",   "wa:fu")],
    [btn("👤 Kontak Baru",     "wa:dir:tidak_dikenal"), btn("💬 Chat Terbaru", "wa:tb")],
    [btn("🟢 AI On",           "st:wa:on"),  btn("🔴 AI Off",     "st:wa:off")],
    [btn("🔄 Refresh",         "wa:st"),     btnBack("wa:m")]
  ];

  if (mode === "edit") await editMenu(ctx, text, rows);
  else await sendMenu(ctx, text, rows);
}

// ─── /wa_export → Export direktori ke Drive ───────────────
bot.command("wa_export", async (ctx) => {
  if (!isAuthorized(ctx.chat.id)) return;
  await editMenu(ctx, "⏳ Mengekspor direktori kontak ke Drive...", []);
  try {
    const { listContacts } = require("./core/contacts/contact-manager");
    const all = await listContacts();
    const fsExtra = require("fs-extra");
    const exportData = {
      exported_at: new Date().toISOString(),
      total: all.length,
      contacts: all
    };
    const tmpFile = "/tmp/ternion-contacts-export.json";
    await fsExtra.writeJson(tmpFile, exportData, { spaces: 2 });
    const { uploadFile } = require("./core/integrations/drive-backup");
    await uploadFile(tmpFile, "CORE-SYSTEM/contacts");
    await ctx.reply(`✅ Direktori diexport ke Drive\nFolder: CORE-SYSTEM/contacts\nTotal: ${all.length} kontak`);
  } catch (err) {
    await ctx.reply(`❌ Export gagal: ${err.message}`);
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

// ═══════════════════════════════════════════════════════════
// GOOGLE CALENDAR — JADWAL & REMINDER
// ═══════════════════════════════════════════════════════════

const pendingCalendarAuth = new Map(); // chatId → "waiting_code"

// ─── Helper: jalankan calendar command dengan error handling ─
async function withCalendar(ctx, fn) {
  try {
    const cal = require("./core/integrations/calendar");
    return await fn(cal);
  } catch (err) {
    if (err.message && (err.message.includes("insufficient") || err.message.includes("401"))) {
      const cal = require("./core/integrations/calendar");
      const url = cal.getAuthUrl();
      pendingCalendarAuth.set(ctx.chat.id, "waiting_code");
      await ctx.replyWithHTML(
        `🔐 <b>Perlu Otorisasi Google Calendar</b>\n\n` +
        `Klik link berikut untuk izinkan akses:\n` +
        `<a href="${url}">Klik di sini untuk otorisasi</a>\n\n` +
        `Setelah dapat kode, kirim: <code>/auth-code [kode]</code>`
      );
    } else {
      await ctx.reply(`❌ Calendar error: ${err.message}`);
    }
    return null;
  }
}

// ─── /jadwal — event hari ini + besok ───────────────────────
bot.command("jadwal", async (ctx) => {
  if (!isAuthorized(ctx.chat.id)) return;
  const args = ctx.message.text.split(" ").slice(1);
  const sub = args[0]?.toLowerCase();

  await withCalendar(ctx, async (cal) => {
    let events, title;

    if (sub === "minggu") {
      events = await cal.listEvents(7);
      title = "JADWAL 7 HARI KE DEPAN";
    } else if (sub === "bulan") {
      events = await cal.listEvents(30);
      title = "JADWAL BULAN INI";
    } else {
      // Default: hari ini + besok
      events = await cal.listEvents(2);
      title = "JADWAL TERNION";
    }

    const text = cal.formatEvents(events, title);
    await ctx.replyWithHTML(text);
  });
});

// ─── /deadline — event 3 hari ke depan ─────────────────────
bot.command("deadline", async (ctx) => {
  if (!isAuthorized(ctx.chat.id)) return;
  await withCalendar(ctx, async (cal) => {
    const events = await cal.getUpcomingDeadlines(3);
    const text = cal.formatEvents(events, "DEADLINE MENDEKAT (3 HARI)");
    await ctx.replyWithHTML(text);
  });
});

// ─── /tambah jadwal — tambah event ─────────────────────────
bot.command("tambah", async (ctx) => {
  if (!isAuthorized(ctx.chat.id)) return;
  const args = ctx.message.text.replace(/^\/tambah\s*/i, "").trim();

  if (!args.toLowerCase().startsWith("jadwal")) {
    return; // bukan jadwal command
  }

  const detail = args.replace(/^jadwal\s*/i, "").trim();
  if (!detail) return ctx.reply("Format: /tambah jadwal [detail]\nContoh: /tambah jadwal Meeting tender besok jam 10");

  await withCalendar(ctx, async (cal) => {
    await ctx.reply("⏳ Parsing jadwal...");
    const parsed = await cal.parseScheduleFromText(detail);

    if (!parsed || !parsed.title || !parsed.date) {
      return ctx.reply("❌ Gagal parse jadwal. Coba format lebih spesifik.\nContoh: Meeting tender Dinas PU besok jam 10 pagi di kantor dinas");
    }

    const event = await cal.createEvent(
      parsed.title,
      parsed.date,
      parsed.time,
      parsed.description,
      parsed.location
    );

    const timeInfo = parsed.time ? ` jam ${parsed.time} WITA` : " (sepanjang hari)";
    const locInfo = parsed.location ? `\n📍 ${parsed.location}` : "";

    await ctx.replyWithHTML(
      `✅ <b>Ditambahkan ke Google Calendar!</b>\n\n` +
      `📌 ${event.summary}\n` +
      `📅 ${new Date(parsed.date).toLocaleDateString("id-ID", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}${timeInfo}` +
      `${locInfo}\n\n` +
      `🔗 <a href="${event.htmlLink}">Lihat di Calendar</a>`
    );
  });
});

// ─── /hapus jadwal — hapus event ────────────────────────────
bot.command("hapus", async (ctx) => {
  if (!isAuthorized(ctx.chat.id)) return;
  const args = ctx.message.text.replace(/^\/hapus\s*/i, "").trim();

  if (!args.toLowerCase().startsWith("jadwal")) return;

  const query = args.replace(/^jadwal\s*/i, "").trim();
  if (!query) return ctx.reply("Format: /hapus jadwal [nama event atau ID]");

  await withCalendar(ctx, async (cal) => {
    // Cari event yang cocok
    const events = await cal.listEvents(30);
    const found = events.find(e =>
      e.summary?.toLowerCase().includes(query.toLowerCase()) || e.id === query
    );

    if (!found) return ctx.reply(`❌ Event "${query}" tidak ditemukan dalam 30 hari ke depan.`);

    await cal.deleteEvent(found.id);
    await ctx.reply(`✅ Event dihapus: "${found.summary}"`);
  });
});

// ─── /auth-code — terima kode OAuth ─────────────────────────
bot.command("auth_code", async (ctx) => {
  if (!isAuthorized(ctx.chat.id)) return;
  const code = ctx.message.text.split(" ").slice(1).join("").trim();
  if (!code) return ctx.reply("Format: /auth_code [kode dari Google]");

  try {
    const cal = require("./core/integrations/calendar");
    await cal.setTokenFromCode(code);
    pendingCalendarAuth.delete(ctx.chat.id);
    await ctx.reply("✅ Google Calendar berhasil diotorisasi! Coba /jadwal sekarang.");
  } catch (err) {
    await ctx.reply(`❌ Auth gagal: ${err.message}`);
  }
});

// ─── /auth-calendar — link otorisasi manual ─────────────────
bot.command("auth_calendar", async (ctx) => {
  if (!isAuthorized(ctx.chat.id)) return;
  const cal = require("./core/integrations/calendar");
  const url = cal.getAuthUrl();
  pendingCalendarAuth.set(ctx.chat.id, "waiting_code");
  await ctx.replyWithHTML(
    `🔐 <b>Otorisasi Google Calendar</b>\n\n` +
    `1. Klik link berikut:\n<a href="${url}">Otorisasi Google Calendar</a>\n\n` +
    `2. Login dengan akun Google kamu\n` +
    `3. Izinkan semua permissions\n` +
    `4. Copy kode yang muncul\n` +
    `5. Kirim: <code>/auth_code [kode]</code>`
  );
});

bot.launch({ dropPendingUpdates: true }).catch((err) => {
  console.error("[BOT_LAUNCH_ERROR]", err.message);
});

console.log("TERNION-AI TELEGRAM ONLINE");

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));

module.exports = { getConversationCount: () => conversationCountToday };
