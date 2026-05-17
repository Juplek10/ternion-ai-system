require("dotenv").config();
const axios = require("axios");


const activeReminders = [];

async function sendTelegram(message) {
  console.log('[NOTIFY]', message.substring(0, 100));
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
