require("dotenv").config();
const axios = require("axios");

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || "8615852356:AAGzjiONLbkuSKBvXePPwhuKACkCZMC0QaY";
const CHAT_ID = 6935073123;

const activeReminders = [];

async function sendTelegram(message) {
  try {
    await axios.post(
      `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`,
      { chat_id: CHAT_ID, text: message, parse_mode: "HTML" },
      { timeout: 15000 }
    );
  } catch (err) {
    console.error("[REMINDER] Gagal kirim:", err.message);
  }
}

function setReminder(minutes, message) {
  const ms = parseInt(minutes) * 60 * 1000;
  if (isNaN(ms) || ms <= 0) {
    return `Durasi tidak valid: "${minutes}" menit`;
  }

  const fireAt = new Date(Date.now() + ms);
  const fireStr = fireAt.toLocaleTimeString("id-ID", { timeZone: "Asia/Makassar" });

  const timerId = setTimeout(async () => {
    const idx = activeReminders.findIndex(r => r.id === timerId);
    if (idx > -1) activeReminders.splice(idx, 1);

    await sendTelegram(
      `⏰ <b>PENGINGAT TERNION-AI</b>\n\n${message}\n\n<i>— dikirim ${minutes} menit yang lalu</i>`
    );
  }, ms);

  activeReminders.push({ id: timerId, message, fireAt: fireAt.toISOString(), minutes });

  return `✅ Pengingat diset! Saya akan kirim notifikasi dalam ${minutes} menit (sekitar jam ${fireStr} WITA).\n\nPesan: "${message}"`;
}

function listReminders() {
  if (activeReminders.length === 0) return "Tidak ada pengingat aktif.";
  return activeReminders
    .map((r, i) => `${i + 1}. [${r.minutes} menit] "${r.message}" — jam ${new Date(r.fireAt).toLocaleTimeString("id-ID", { timeZone: "Asia/Makassar" })} WITA`)
    .join("\n");
}

module.exports = { setReminder, listReminders };
