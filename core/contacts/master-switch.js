require("dotenv").config();

const fs = require("fs-extra");
const axios = require("axios");

const STATE_FILE = "/root/ai-system/memory/system-state.json";

const NEXUS_NUMBER = "6282266130808";

const KEYWORDS_OFF = ["stop", "pause", "istirahat", "off", "diam dulu", "stop ai", "matikan ai", "ai off", "nonaktif"];
const KEYWORDS_ON = ["aktif", "start", "on", "hidup", "aktifkan", "resume", "hidupkan", "ai on", "nyalakan ai"];
const KEYWORDS_STATUS = ["status ai", "cek ai", "ai status", "kondisi ai"];
const KEYWORD_DARURAT = ["darurat", "urgent", "emergency", "gawat", "penting banget", "segera", "bahaya"];
const PAUSE_PATTERN = /pause\s+(\d+)\s*(menit|jam|hour|minute)/i;

let autoResumeTimer = null;

// ─── Load state ────────────────────────────────────────────
async function loadState() {
  try {
    await fs.ensureFile(STATE_FILE);
    const data = await fs.readJson(STATE_FILE).catch(() => null);
    return data || {
      ai_active: true,
      paused_by: null,
      paused_at: null,
      auto_resume_at: null
    };
  } catch {
    return { ai_active: true, paused_by: null, paused_at: null, auto_resume_at: null };
  }
}

async function saveState(state) {
  await fs.ensureFile(STATE_FILE);
  await fs.writeJson(STATE_FILE, state, { spaces: 2 });
}

// ─── Cek apakah nomor adalah NEXUS ─────────────────────────
function isNexus(nomor) {
  const clean = nomor.replace("@c.us", "").replace("+", "");
  return clean === NEXUS_NUMBER;
}

// ─── Apakah AI aktif? ─────────────────────────────────────
async function isActive() {
  const state = await loadState();
  if (!state.ai_active) return false;
  if (state.auto_resume_at) {
    if (new Date() >= new Date(state.auto_resume_at)) {
      await activateAI("auto-resume");
      return true;
    }
    return false;
  }
  return state.ai_active;
}

// ─── Deteksi pesan darurat ─────────────────────────────────
function isDarurat(teks) {
  const lower = teks.toLowerCase();
  return KEYWORD_DARURAT.some(k => lower.includes(k));
}

// ─── Matikan AI ────────────────────────────────────────────
async function deactivateAI(by) {
  const state = await loadState();
  state.ai_active = false;
  state.paused_by = by || "nexus";
  state.paused_at = new Date().toISOString();
  state.auto_resume_at = null;
  await saveState(state);

  if (autoResumeTimer) { clearTimeout(autoResumeTimer); autoResumeTimer = null; }

  await notifyTelegramSwitch("🔴 AI WA dimatikan NEXUS");
}

// ─── Aktifkan AI ───────────────────────────────────────────
async function activateAI(by) {
  const state = await loadState();
  state.ai_active = true;
  state.paused_by = null;
  state.paused_at = null;
  state.auto_resume_at = null;
  await saveState(state);

  if (autoResumeTimer) { clearTimeout(autoResumeTimer); autoResumeTimer = null; }

  if (by !== "auto-resume") {
    await notifyTelegramSwitch("🟢 AI WA diaktifkan NEXUS");
  } else {
    await notifyTelegramSwitch("🟢 AI WA aktif kembali (auto-resume)");
  }
}

// ─── Pause sementara ───────────────────────────────────────
async function pauseAI(menit) {
  const state = await loadState();
  state.ai_active = false;
  state.paused_by = "nexus";
  state.paused_at = new Date().toISOString();
  const resumeAt = new Date(Date.now() + menit * 60 * 1000);
  state.auto_resume_at = resumeAt.toISOString();
  await saveState(state);

  if (autoResumeTimer) clearTimeout(autoResumeTimer);
  autoResumeTimer = setTimeout(async () => {
    await activateAI("auto-resume");
    autoResumeTimer = null;
  }, menit * 60 * 1000);
}

// ─── Cek status ────────────────────────────────────────────
async function getStatus() {
  const state = await loadState();
  if (state.ai_active) return "🟢 AI aktif";
  if (state.auto_resume_at) {
    const resumeStr = new Date(state.auto_resume_at).toLocaleTimeString("id-ID", {
      hour: "2-digit", minute: "2-digit", timeZone: "Asia/Makassar"
    });
    return `🟡 AI dipause, aktif kembali pukul ${resumeStr} WITA`;
  }
  return "🔴 AI nonaktif";
}

// ─── Notif Telegram ────────────────────────────────────────
async function notifyTelegramSwitch(teks) {
  try {
    console.log('[NOTIFY]', message);
  } catch (err) {
    console.error("[SWITCH] Gagal notif Telegram:", err.message);
  }
}

// ─── Handle pesan dari NEXUS terkait switch ────────────────
async function handleNexusSwitch(teks) {
  const lower = teks.toLowerCase().trim();

  if (KEYWORDS_STATUS.some(k => lower.includes(k))) {
    return await getStatus();
  }

  const pauseMatch = teks.match(PAUSE_PATTERN);
  if (pauseMatch) {
    const angka = parseInt(pauseMatch[1]);
    const satuan = pauseMatch[2].toLowerCase();
    const menit = satuan.includes("jam") || satuan.includes("hour") ? angka * 60 : angka;
    await pauseAI(menit);
    const resumeStr = new Date(Date.now() + menit * 60 * 1000).toLocaleTimeString("id-ID", {
      hour: "2-digit", minute: "2-digit", timeZone: "Asia/Makassar"
    });
    return `✅ AI dipause selama ${menit} menit.\nAktif kembali otomatis pukul ${resumeStr} WITA.`;
  }

  if (KEYWORDS_OFF.some(k => lower === k || lower.startsWith(k + " ") || lower.endsWith(" " + k) || lower.includes(k))) {
    await deactivateAI("nexus");
    return "✅ AI dinonaktifkan.\nKirim 'aktif' untuk hidupkan lagi.";
  }

  if (KEYWORDS_ON.some(k => lower === k || lower.startsWith(k + " ") || lower.endsWith(" " + k) || lower.includes(k))) {
    await activateAI("nexus");
    return "✅ AI diaktifkan kembali.";
  }

  return null;
}

// ─── Kirim notif pesan masuk saat AI nonaktif ──────────────
async function notifyBrianIncomingWhenOff(nama, nomor, teks) {
  const jamStr = new Date().toLocaleTimeString("id-ID", {
    hour: "2-digit", minute: "2-digit", timeZone: "Asia/Makassar"
  });

  const msg =
    `💬 <b>PESAN MASUK (AI nonaktif)</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `👤 Dari: ${nama} (${nomor})\n` +
    `💬 Pesan: ${teks.substring(0, 300)}\n` +
    `⏰ ${jamStr} WITA`;

  try {
    console.log('[NOTIFY]', message);
  } catch (err) {
    console.error("[SWITCH] Gagal notif pesan masuk:", err.message);
  }
}

module.exports = {
  isNexus,
  isActive,
  isDarurat,
  deactivateAI,
  activateAI,
  pauseAI,
  getStatus,
  handleNexusSwitch,
  notifyBrianIncomingWhenOff,
  loadState,
  NEXUS_NUMBER,
  KEYWORDS_OFF,
  KEYWORDS_ON
};
