require("dotenv").config();

const fs = require("fs-extra");
const path = require("path");
const axios = require("axios");
const askOllama = require("../providers/ollama");

const SESSIONS_DIR = "/root/ai-system/sessions";
const DREAMS_DIR = "/root/ai-system/memory/dreams";
const LONG_TERM_MEMORY = "/root/ai-system/memory/long-term.json";
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || "8615852356:AAGzjiONLbkuSKBvXePPwhuKACkCZMC0QaY";
const CHAT_ID = 6935073123;

// ─── Kirim Telegram ─────────────────────────────────────
async function sendTelegram(message) {
  try {
    await axios.post(
      `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`,
      { chat_id: CHAT_ID, text: message, parse_mode: "HTML" },
      { timeout: 15000 }
    );
  } catch (err) {
    console.error("[DREAM] Gagal kirim Telegram:", err.message);
  }
}

// ─── Baca semua session hari ini ────────────────────────
async function getTodaySessions() {
  const today = new Date().toISOString().split("T")[0];
  const allMessages = [];

  try {
    await fs.ensureDir(SESSIONS_DIR);
    const files = await fs.readdir(SESSIONS_DIR);

    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      try {
        const session = await fs.readJson(path.join(SESSIONS_DIR, file));
        const todayMsgs = (session.history || []).filter(m => {
          return m.timestamp && m.timestamp.startsWith(today);
        });
        allMessages.push(...todayMsgs);
      } catch (e) {}
    }
  } catch (err) {
    console.error("[DREAM] Error baca sessions:", err.message);
  }

  return allMessages;
}

// ─── Generate dream report dengan Ollama ────────────────
async function generateDreamReport(messages) {
  if (messages.length === 0) {
    return null;
  }

  const transcript = messages
    .filter(m => m.role === "user")
    .map(m => m.content.substring(0, 200))
    .slice(-20)
    .join("\n---\n");

  const prompt = `Berikut adalah percakapan hari ini antara Brian Kinayom dan Ternion-AI:

${transcript}

Buatkan DREAM REPORT singkat dengan format berikut:
TOPIK_UTAMA: [list topik yang dibahas, pisahkan dengan |]
INSIGHT: [insight atau temuan penting, pisahkan dengan |]
PERHATIAN: [hal yang perlu diperhatikan, pisahkan dengan |]
REKOMENDASI: [rekomendasi untuk besok, pisahkan dengan |]

Jawab dalam Bahasa Indonesia, singkat dan padat.`;

  try {
    const raw = await askOllama(prompt);
    return raw;
  } catch (err) {
    console.error("[DREAM] Ollama error:", err.message);
    return null;
  }
}

// ─── Parse hasil Ollama menjadi struktur ────────────────
function parseDreamOutput(raw) {
  const extract = (label) => {
    const match = raw.match(new RegExp(`${label}:\\s*(.+)`));
    if (!match) return [];
    return match[1].split("|").map(s => s.trim()).filter(Boolean);
  };

  return {
    topik: extract("TOPIK_UTAMA"),
    insight: extract("INSIGHT"),
    perhatian: extract("PERHATIAN"),
    rekomendasi: extract("REKOMENDASI")
  };
}

// ─── Update long-term memory ────────────────────────────
async function updateLongTermMemory(parsed, date) {
  try {
    await fs.ensureFile(LONG_TERM_MEMORY);
    let mem = {};
    try { mem = await fs.readJson(LONG_TERM_MEMORY); } catch (e) {}

    if (!mem.learnings) mem.learnings = [];
    if (!mem.conversations) mem.conversations = [];

    mem.conversations.push({
      date,
      topik: parsed.topik,
      insight: parsed.insight
    });

    for (const item of parsed.insight) {
      mem.learnings.push({ date, content: item });
    }

    // Jaga ukuran
    if (mem.conversations.length > 90) mem.conversations = mem.conversations.slice(-90);
    if (mem.learnings.length > 500) mem.learnings = mem.learnings.slice(-500);

    await fs.writeJson(LONG_TERM_MEMORY, mem, { spaces: 2 });
  } catch (err) {
    console.error("[DREAM] Gagal update long-term memory:", err.message);
  }
}

// ─── MAIN DREAM PROCESS ──────────────────────────────────
async function runDream() {
  const now = new Date();
  const date = now.toISOString().split("T")[0];
  const dateStr = now.toLocaleDateString("id-ID", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Makassar"
  });

  console.log(`[DREAM] Memulai dream process: ${date}`);

  const messages = await getTodaySessions();
  const userMsgs = messages.filter(m => m.role === "user");
  const sesiCount = new Set(messages.map(m => m.timestamp?.split("T")[0])).size || 1;

  console.log(`[DREAM] Total pesan hari ini: ${messages.length}`);

  const rawReport = await generateDreamReport(messages);
  const parsed = rawReport ? parseDreamOutput(rawReport) : {
    topik: ["Tidak ada percakapan hari ini"],
    insight: [],
    perhatian: [],
    rekomendasi: ["Lanjutkan rutinitas besok"]
  };

  // Simpan dream report ke file JSON
  const dreamData = {
    date,
    generated_at: now.toISOString(),
    sesi: sesiCount,
    pesan_total: messages.length,
    pesan_user: userMsgs.length,
    ...parsed,
    raw: rawReport
  };

  await fs.ensureDir(DREAMS_DIR);
  await fs.writeJson(path.join(DREAMS_DIR, `${date}.json`), dreamData, { spaces: 2 });
  console.log(`[DREAM] Saved: ${date}.json`);

  // Update long-term memory
  await updateLongTermMemory(parsed, date);

  // Format report untuk Telegram (dikirim jam 06.00)
  const topikList = parsed.topik.length > 0
    ? parsed.topik.map(t => `  • ${t}`).join("\n")
    : "  • (tidak ada)";
  const insightList = parsed.insight.length > 0
    ? parsed.insight.map(i => `  • ${i}`).join("\n")
    : "  • (tidak ada)";
  const perhatianList = parsed.perhatian.length > 0
    ? parsed.perhatian.map(p => `  • ${p}`).join("\n")
    : "  • (tidak ada)";
  const rekomendasiList = parsed.rekomendasi.length > 0
    ? parsed.rekomendasi.map(r => `  • ${r}`).join("\n")
    : "  • (tidak ada)";

  const report =
`📅 <b>DREAM REPORT ${dateStr}</b>

🗣️ <b>Percakapan:</b> ${userMsgs.length} pesan
📌 <b>Topik utama:</b>
${topikList}
💡 <b>Insight baru:</b>
${insightList}
⚠️ <b>Hal yang perlu diperhatikan:</b>
${perhatianList}
🎯 <b>Rekomendasi untuk besok:</b>
${rekomendasiList}`;

  return { report, dreamData };
}

// ─── Cek apakah jam 03.00 WITA (UTC+8 = UTC+8, jadi jam 19.00 UTC) ──
function isTime(targetHour, targetMinute, tzOffset = 8) {
  const now = new Date();
  const utcH = now.getUTCHours();
  const localH = (utcH + tzOffset) % 24;
  const localM = now.getUTCMinutes();
  return localH === targetHour && localM < 5; // toleransi 5 menit
}

// ─── Loop dream scheduler ────────────────────────────────
let dreamDoneToday = null;
let morningReportSent = null;
let pendingReport = null;

async function dreamScheduler() {
  const today = new Date().toISOString().split("T")[0];

  // Jam 03.00 WITA → proses dream
  if (isTime(3, 0) && dreamDoneToday !== today) {
    dreamDoneToday = today;
    console.log("[DREAM] Jam 03.00 WITA — mulai dream process");
    try {
      const result = await runDream();
      pendingReport = result.report;
    } catch (err) {
      console.error("[DREAM] Error dream process:", err.message);
    }
  }

  // Jam 06.00 WITA → kirim ke Telegram
  if (isTime(6, 0) && morningReportSent !== today && pendingReport) {
    morningReportSent = today;
    console.log("[DREAM] Jam 06.00 WITA — kirim dream report ke Telegram");
    await sendTelegram(pendingReport);
    pendingReport = null;
  }
}

// Cek setiap menit
setInterval(dreamScheduler, 60 * 1000);
dreamScheduler(); // cek langsung saat start

module.exports = { runDream, sendTelegram };
