require("dotenv").config();

const fs = require("fs-extra");
const axios = require("axios");

const FOLLOWUP_FILE = "/root/ai-system/memory/follow-ups/list.json";

const TRIGGER_KEYWORDS = [
  "nanti saya kirim", "nanti kirim", "nanti saya bawa",
  "besok", "besok saya", "besok kami",
  "minggu depan", "pekan depan",
  "segera", "akan saya proses", "akan saya kirim",
  "akan saya siapkan", "akan kami siapkan",
  "dalam waktu dekat", "secepatnya", "sesegera mungkin",
  "nanti malam", "sore ini", "hari ini saya",
  "sedang saya proses", "sedang diproses",
  "tunggu ya", "tunggu sebentar"
];

// ─── Load/save follow-ups ──────────────────────────────────
async function loadFollowUps() {
  try {
    await fs.ensureFile(FOLLOWUP_FILE);
    return await fs.readJson(FOLLOWUP_FILE).catch(() => ({ followups: [] }));
  } catch {
    return { followups: [] };
  }
}

async function saveFollowUps(data) {
  await fs.ensureFile(FOLLOWUP_FILE);
  await fs.writeJson(FOLLOWUP_FILE, data, { spaces: 2 });
}

// ─── Detect follow-up trigger ──────────────────────────────
function detectFollowUpTrigger(teks) {
  const lower = teks.toLowerCase();
  const found = TRIGGER_KEYWORDS.filter(k => lower.includes(k));
  if (found.length === 0) return null;

  // Estimasi deadline
  let deadline = new Date();
  if (lower.includes("besok")) deadline.setDate(deadline.getDate() + 1);
  else if (lower.includes("minggu depan") || lower.includes("pekan depan")) deadline.setDate(deadline.getDate() + 7);
  else if (lower.includes("sore ini") || lower.includes("nanti malam")) deadline.setHours(deadline.getHours() + 8);
  else deadline.setDate(deadline.getDate() + 2);

  return {
    keywords: found,
    estimated_deadline: deadline.toISOString().split("T")[0]
  };
}

// ─── Set follow-up ─────────────────────────────────────────
async function setFollowUp(nomor, nama, konteks, deadline) {
  const data = await loadFollowUps();
  const id = `FU_${Date.now().toString(36).toUpperCase()}`;

  data.followups.push({
    id,
    nomor: nomor.replace("@c.us", "").replace("+", ""),
    nama,
    konteks: konteks.substring(0, 300),
    deadline: deadline || new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    status: "pending",
    created_at: new Date().toISOString(),
    reminded_at: null,
    escalated_at: null
  });

  await saveFollowUps(data);
  return id;
}

// ─── Check dan kirim reminder ──────────────────────────────
async function checkAndSendReminders(waClient) {
  const data = await loadFollowUps();
  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  let updated = false;

  for (const fu of data.followups) {
    if (fu.status !== "pending") continue;

    // H-1 → kirim WA reminder
    if (fu.deadline === tomorrow && !fu.reminded_at) {
      if (waClient) {
        try {
          await waClient.sendMessage(`${fu.nomor}@c.us`,
            `Halo ${fu.nama || "Bapak/Ibu"}, mengingatkan kembali mengenai: *${fu.konteks}*\n\nDijadwalkan besok. Mohon konfirmasinya. 🙏`
          );
        } catch {}
      }
      fu.reminded_at = new Date().toISOString();
      updated = true;
    }

    // H+1 belum respons → alert Brian
    if (fu.deadline <= yesterday && !fu.escalated_at) {
      await alertBrianFollowUp(fu);
      fu.escalated_at = new Date().toISOString();
      updated = true;
    }
  }

  if (updated) await saveFollowUps(data);
}

async function alertBrianFollowUp(fu) {
  const msg =
    `⏰ <b>FOLLOW-UP BELUM DIRESPONS</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `👤 Kontak: ${fu.nama} (${fu.nomor})\n` +
    `📋 Yang ditunggu: ${fu.konteks}\n` +
    `📅 Deadline: kemarin (${fu.deadline})\n\n` +
    `Command:\n` +
    `/followup-lanjut ${fu.id} — follow-up lagi\n` +
    `/followup-cancel ${fu.id} — batalkan`;

  try {
    console.log('[NOTIFY]', message);
  } catch (err) {
    console.error("[FOLLOWUP] Gagal alert Brian:", err.message);
  }
}

async function listFollowUps(status) {
  const data = await loadFollowUps();
  if (status) return data.followups.filter(f => f.status === status);
  return data.followups;
}

async function cancelFollowUp(id) {
  const data = await loadFollowUps();
  const fu = data.followups.find(f => f.id === id);
  if (!fu) return false;
  fu.status = "cancelled";
  fu.cancelled_at = new Date().toISOString();
  await saveFollowUps(data);
  return true;
}

async function completeFollowUp(id) {
  const data = await loadFollowUps();
  const fu = data.followups.find(f => f.id === id);
  if (!fu) return false;
  fu.status = "done";
  fu.completed_at = new Date().toISOString();
  await saveFollowUps(data);
  return true;
}

// ─── Loop check setiap jam ─────────────────────────────────
function startFollowUpLoop(waClient) {
  console.log("[FOLLOWUP] Engine started");
  checkAndSendReminders(waClient).catch(console.error);
  setInterval(() => {
    checkAndSendReminders(waClient).catch(console.error);
  }, 60 * 60 * 1000);
}

module.exports = {
  detectFollowUpTrigger,
  setFollowUp,
  checkAndSendReminders,
  listFollowUps,
  cancelFollowUp,
  completeFollowUp,
  startFollowUpLoop,
  TRIGGER_KEYWORDS
};

// ─── Standalone mode (dijalankan oleh PM2 langsung) ──────
if (require.main === module) {
  console.log("[FOLLOWUP-ENGINE] Standalone mode — cek setiap jam");
  checkAndSendReminders(null).catch(console.error);
  setInterval(() => {
    checkAndSendReminders(null).catch(console.error);
  }, 60 * 60 * 1000);
  process.once("SIGINT", () => process.exit(0));
  process.once("SIGTERM", () => process.exit(0));
}
