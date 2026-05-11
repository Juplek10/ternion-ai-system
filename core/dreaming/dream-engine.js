require("dotenv").config();

const fs = require("fs-extra");
const path = require("path");
const axios = require("axios");
const { execFile } = require("child_process");
const { promisify } = require("util");
const askClaude = require("../providers/claude-pipe");

const execFileAsync = promisify(execFile);

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

// ─── Generate dream report + proactive insights ──────────
async function generateDreamReport(messages) {
  if (messages.length === 0) return null;

  const transcript = messages
    .filter(m => m.role === "user")
    .map(m => m.content.substring(0, 200))
    .slice(-20)
    .join("\n---\n");

  const prompt = `Berikut adalah percakapan hari ini antara Brian Kinayom (Founder TERNION GROUP, Kupang NTT) dan Ternion-AI:

${transcript}

Buatkan DREAM REPORT + PROACTIVE INSIGHTS dengan format WAJIB:
TOPIK_UTAMA: [list topik, pisahkan dengan |]
INSIGHT: [temuan penting, pisahkan dengan |]
PERHATIAN: [hal yang perlu diwaspadai, pisahkan dengan |]
REKOMENDASI: [rekomendasi konkret untuk besok, pisahkan dengan |]
PELUANG_TIDAK_DITINDAKLANJUTI: [peluang bisnis yang disebutkan tapi belum ada aksi, pisahkan dengan |]
AKSI_MENDESAK: [hal yang harus dilakukan Brian besok pagi, pisahkan dengan |]
RISIKO_BISNIS: [risiko bisnis yang perlu diwaspadai minggu ini, pisahkan dengan |]

Jawab dalam Bahasa Indonesia, tajam dan actionable. Fokus pada nilai bisnis nyata untuk TERNION GROUP.`;

  try {
    const raw = await askClaude(prompt, { skipKnowledge: false });
    return raw;
  } catch (err) {
    console.error("[DREAM] Claude error:", err.message);
    return null;
  }
}

// ─── Pattern recognition: topik berulang → knowledge ────
async function runPatternRecognition(date) {
  try {
    const PATTERN_FILE = "/root/ai-system/memory/topic-patterns.json";
    await fs.ensureFile(PATTERN_FILE);
    let patterns = await fs.readJson(PATTERN_FILE).catch(() => ({}));

    // Baca percakapan 7 hari terakhir
    const sessionsDir = SESSIONS_DIR;
    const files = await fs.readdir(sessionsDir).catch(() => []);
    const topicCount = {};

    for (const file of files.filter(f => f.endsWith(".json")).slice(-7)) {
      try {
        const session = await fs.readJson(path.join(sessionsDir, file));
        for (const msg of (session.history || []).filter(m => m.role === "user")) {
          // Ekstrak topik sederhana
          const words = msg.content.toLowerCase().split(/\s+/).filter(w => w.length > 4);
          for (const word of words) {
            if (!["adalah", "dengan", "untuk", "yang", "dalam", "pada", "atau", "tidak", "bisa"].includes(word)) {
              topicCount[word] = (topicCount[word] || 0) + 1;
            }
          }
        }
      } catch {}
    }

    // Topik yang muncul ≥3x → buat knowledge entry
    const { updateKnowledgeFromConversation } = require("../knowledge/ternion-knowledge");
    const hotTopics = Object.entries(topicCount)
      .filter(([, count]) => count >= 3)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10);

    for (const [topic, count] of hotTopics) {
      if (!patterns[topic] || patterns[topic].count < count) {
        patterns[topic] = { count, last_seen: date };
        if (count >= 5) {
          await updateKnowledgeFromConversation(`Topik sering dibahas Brian (${count}x): ${topic}`).catch(() => {});
        }
      }
    }

    await fs.writeJson(PATTERN_FILE, patterns, { spaces: 2 });
    return hotTopics.slice(0, 5).map(([t, c]) => `${t} (${c}x)`);
  } catch (err) {
    console.error("[DREAM] Pattern recognition error:", err.message);
    return [];
  }
}

// ─── Generate dan simpan daily summary ──────────────────
async function generateDailySummary(messages, parsed, date) {
  try {
    const SUMMARY_DIR = "/root/ai-system/memory/daily-summary";
    await fs.ensureDir(SUMMARY_DIR);

    const userMsgs = messages.filter(m => m.role === "user").map(m => m.content.substring(0, 150)).slice(-10);
    const summaryPrompt = `Buat ringkasan 1 paragraf (maksimal 200 kata) dari percakapan Brian hari ini:

Topik: ${(parsed.topik || []).join(", ")}
Pesan user: ${userMsgs.join(" | ")}

Ringkasan harus mencakup: apa yang dibahas, keputusan apa yang dibuat, dan konteks bisnis penting.
Tulis dalam Bahasa Indonesia, padat dan informatif.`;

    let summary = "";
    try {
      const { stdout } = await execFileAsync(
        "claude",
        ["-p", summaryPrompt, "--output-format", "text"],
        { timeout: 30000, maxBuffer: 1024 * 1024 }
      );
      summary = stdout.trim();
    } catch {}

    const summaryData = {
      date,
      summary: summary || `Hari ${date}: ${(parsed.topik || []).join(", ")}`,
      topik: parsed.topik || [],
      keputusan: parsed.insight || [],
      pesan_count: userMsgs.length,
      generated_at: new Date().toISOString()
    };

    await fs.writeJson(path.join(SUMMARY_DIR, `${date}.json`), summaryData, { spaces: 2 });
    console.log(`[DREAM] Daily summary saved: ${date}`);
    return summaryData;
  } catch (err) {
    console.error("[DREAM] Daily summary error:", err.message);
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

const SOUL_PATH = "/root/ai-system/prompts/ternion-soul.txt";
const DREAM_LOG = "/root/ai-system/memory/dream-log.json";

// ─── Teaching Loop: Claude review → update soul ──────────
async function runTeachingLoop(messages, date) {
  if (messages.length === 0) {
    console.log("[DREAM] Teaching loop skip — tidak ada percakapan");
    return null;
  }

  const transcript = messages
    .filter(m => m.role === "user")
    .map(m => m.content.substring(0, 300))
    .slice(-30)
    .join("\n---\n");

  let currentSoul = "";
  try { currentSoul = fs.readFileSync(SOUL_PATH, "utf8").substring(0, 3000); } catch {}

  const reviewPrompt = `Kamu adalah AI trainer untuk sistem Ternion-AI.

SOUL SAAT INI (ringkasan):
${currentSoul.substring(0, 1000)}

PERCAKAPAN HARI INI DENGAN BRIAN:
${transcript}

Tugasmu:
1. Identifikasi topik yang sering ditanya Brian hari ini
2. Identifikasi konteks bisnis baru yang perlu diingat Ollama
3. Identifikasi jika ada jawaban yang perlu diperbaiki
4. Buat tambahan/penyempurnaan untuk system prompt Ollama

Format output WAJIB:
TOPIK_HARI_INI: [topik 1] | [topik 2] | [dst]
KONTEKS_BARU: [fakta bisnis baru] | [dst]
PERBAIKAN: [hal yang perlu diperbaiki] | [dst]
SOUL_TAMBAHAN: [teks tambahan untuk system prompt, max 200 kata]

Jawab dalam Bahasa Indonesia.`;

  let claudeResult = null;
  try {
    const { stdout } = await execFileAsync(
      "claude",
      ["-p", reviewPrompt, "--output-format", "text"],
      { timeout: 90000, maxBuffer: 1024 * 1024 * 2 }
    );
    claudeResult = stdout.trim();
    console.log("[DREAM] Teaching loop Claude selesai");
  } catch (err) {
    console.error("[DREAM] Teaching loop Claude gagal:", err.message);
    return null;
  }

  // Parse hasil Claude
  const extract = (label) => {
    const match = claudeResult.match(new RegExp(`${label}:\\s*(.+)`));
    return match ? match[1].split("|").map(s => s.trim()).filter(Boolean) : [];
  };

  const topikHariIni = extract("TOPIK_HARI_INI");
  const konteksBaru = extract("KONTEKS_BARU");
  const perbaikan = extract("PERBAIKAN");
  const soulTambahan = (() => {
    const m = claudeResult.match(/SOUL_TAMBAHAN:\s*([\s\S]+?)(?:\n[A-Z_]+:|$)/);
    return m ? m[1].trim() : "";
  })();

  // Update soul jika ada tambahan
  let soulUpdated = false;
  if (soulTambahan && soulTambahan.length > 20) {
    try {
      const existingSoul = fs.readFileSync(SOUL_PATH, "utf8");
      const addendum = `\n\n═══════════════════════════════════════\nUPDATE ${date} (Teaching Loop)\n═══════════════════════════════════════\n${soulTambahan}`;
      fs.writeFileSync(SOUL_PATH, existingSoul + addendum, "utf8");
      soulUpdated = true;
      console.log("[DREAM] Soul diupdate oleh teaching loop");
    } catch (err) {
      console.error("[DREAM] Gagal update soul:", err.message);
    }
  }

  // Log ke dream-log.json
  try {
    await fs.ensureFile(DREAM_LOG);
    let log = [];
    try { log = await fs.readJson(DREAM_LOG); } catch { log = []; }
    if (!Array.isArray(log)) log = [];
    log.push({ date, topikHariIni, konteksBaru, perbaikan, soulTambahan, soulUpdated, generated_at: new Date().toISOString() });
    if (log.length > 90) log = log.slice(-90);
    await fs.writeJson(DREAM_LOG, log, { spaces: 2 });
  } catch {}

  return { topikHariIni, konteksBaru, perbaikan, soulTambahan, soulUpdated, percakapanDiproses: messages.filter(m => m.role === "user").length };
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

  // Pattern recognition — topik berulang → knowledge
  const hotTopics = await runPatternRecognition(date).catch(() => []);

  // Daily summary untuk konteks hari berikutnya
  await generateDailySummary(messages, parsed, date).catch(() => {});

  // Teaching Loop: Claude review → update soul
  const teaching = await runTeachingLoop(messages, date).catch(err => {
    console.error("[DREAM] Teaching loop error:", err.message);
    return null;
  });

  // Prompt optimizer: improve agents berdasarkan feedback
  let evolutionReport = "";
  try {
    const { runPromptOptimizer } = require("../evolution/prompt-optimizer");
    const evo = await runPromptOptimizer();
    if (evo.updated.length > 0) {
      evolutionReport = `\n━━━━━━━━━━━━━━━━━━━━━━━\n🧬 <b>Agent Evolution:</b>\n  🔄 Updated: ${evo.updated.map(u => u.agent).join(", ")}`;
    }
  } catch (err) {
    console.error("[DREAM] Prompt optimizer error:", err.message);
  }

  // Format proactive insights
  const extract = (label) => {
    if (!rawReport) return [];
    const match = rawReport.match(new RegExp(`${label}:\\s*(.+)`));
    return match ? match[1].split("|").map(s => s.trim()).filter(Boolean) : [];
  };
  const peluang = extract("PELUANG_TIDAK_DITINDAKLANJUTI");
  const aksiMendesak = extract("AKSI_MENDESAK");
  const risikoBisnis = extract("RISIKO_BISNIS");

  const listOrEmpty = (arr) => arr.length > 0 ? arr.map(t => `  • ${t}`).join("\n") : "  • (tidak ada)";

  const proactiveSection = (peluang.length > 0 || aksiMendesak.length > 0)
    ? `\n━━━━━━━━━━━━━━━━━━━━━━━\n🎯 <b>INSIGHT TERNION-AI</b>\n⚡ Aksi mendesak besok:\n${listOrEmpty(aksiMendesak)}\n💡 Peluang belum ditindaklanjuti:\n${listOrEmpty(peluang)}\n⚠️ Risiko yang perlu diwaspadai:\n${listOrEmpty(risikoBisnis)}`
    : "";

  const hotTopicSection = hotTopics.length > 0
    ? `\n🔥 <b>Hot topics minggu ini:</b> ${hotTopics.join(", ")}`
    : "";

  const teachingSection = teaching
    ? `\n━━━━━━━━━━━━━━━━━━━━━━━\n🎓 <b>Teaching Loop:</b>\n  💬 Diproses: ${teaching.percakapanDiproses} pesan\n  ✨ Soul update: ${teaching.soulUpdated ? "Ya" : "Tidak ada perubahan"}`
    : "";

  const report =
`🌙 <b>DREAM REPORT ${dateStr}</b>
━━━━━━━━━━━━━━━━━━━━━━━
🗣️ <b>Percakapan:</b> ${userMsgs.length} pesan
📌 <b>Topik utama:</b>
${listOrEmpty(parsed.topik)}
💡 <b>Insight baru:</b>
${listOrEmpty(parsed.insight)}
⚠️ <b>Perhatian:</b>
${listOrEmpty(parsed.perhatian)}
🎯 <b>Rekomendasi besok:</b>
${listOrEmpty(parsed.rekomendasi)}${proactiveSection}${hotTopicSection}${teachingSection}${evolutionReport}`;

  return { report, dreamData, teaching };
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

  // Jam 02.00 WITA → teaching loop Claude (sebelum dream)
  if (isTime(2, 0) && dreamDoneToday !== `tl_${today}`) {
    dreamDoneToday = `tl_${today}`;
    console.log("[DREAM] Jam 02.00 WITA — Teaching Loop mulai");
    const msgs = await getTodaySessions().catch(() => []);
    await runTeachingLoop(msgs, today).catch(err => console.error("[DREAM] Teaching loop:", err.message));
  }

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
