require("dotenv").config();

const { google, oauth2Client } = require("./google");
const fs = require("fs");

const TOKEN_PATH = "/root/ai-system/tokens/google-token.json";
const CALENDAR_ID = "primary";

// Scope yang dibutuhkan (termasuk calendar)
const SCOPES = [
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/documents",
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/calendar.events"
];

function getAuthUrl() {
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent"
  });
}

async function setTokenFromCode(code) {
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);
  let existing = {};
  try { existing = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf8")); } catch {}
  const merged = { ...existing, ...tokens };
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(merged, null, 2));
  return tokens;
}

function loadAndSetToken() {
  try {
    const token = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf8"));
    oauth2Client.setCredentials(token);
    return true;
  } catch {
    return false;
  }
}

function getCalendar() {
  loadAndSetToken();
  return google.calendar({ version: "v3", auth: oauth2Client });
}

// ─── List event X hari ke depan ─────────────────────────
async function listEvents(days = 7) {
  const cal = getCalendar();
  const timeMin = new Date().toISOString();
  const timeMax = new Date(Date.now() + days * 86400000).toISOString();

  const res = await cal.events.list({
    calendarId: CALENDAR_ID,
    timeMin,
    timeMax,
    singleEvents: true,
    orderBy: "startTime",
    maxResults: 20
  });

  return res.data.items || [];
}

// ─── Event hari ini ──────────────────────────────────────
async function getTodayEvents() {
  const cal = getCalendar();
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);

  const res = await cal.events.list({
    calendarId: CALENDAR_ID,
    timeMin: startOfDay.toISOString(),
    timeMax: endOfDay.toISOString(),
    singleEvents: true,
    orderBy: "startTime",
    maxResults: 10
  });

  return res.data.items || [];
}

// ─── Deadline mendekat (3 hari) ──────────────────────────
async function getUpcomingDeadlines(days = 3) {
  return listEvents(days);
}

// ─── Buat event baru ─────────────────────────────────────
async function createEvent(title, dateStr, timeStr = null, description = "", location = "") {
  const cal = getCalendar();

  let start, end;
  if (timeStr) {
    const startDt = new Date(`${dateStr}T${timeStr}:00+08:00`);
    const endDt = new Date(startDt.getTime() + 3600000); // +1 jam default
    start = { dateTime: startDt.toISOString(), timeZone: "Asia/Makassar" };
    end = { dateTime: endDt.toISOString(), timeZone: "Asia/Makassar" };
  } else {
    start = { date: dateStr };
    end = { date: dateStr };
  }

  const event = {
    summary: title,
    description,
    location,
    start,
    end
  };

  const res = await cal.events.insert({ calendarId: CALENDAR_ID, resource: event });
  return res.data;
}

// ─── Update event ────────────────────────────────────────
async function updateEvent(eventId, data) {
  const cal = getCalendar();
  const res = await cal.events.patch({
    calendarId: CALENDAR_ID,
    eventId,
    resource: data
  });
  return res.data;
}

// ─── Hapus event ─────────────────────────────────────────
async function deleteEvent(eventId) {
  const cal = getCalendar();
  await cal.events.delete({ calendarId: CALENDAR_ID, eventId });
}

// ─── Parse jadwal dari natural language ─────────────────
// Contoh: "Meeting tender besok jam 10 pagi di kantor dinas"
async function parseScheduleFromText(text) {
  const askClaude = require("../providers/claude-pipe");

  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const tomorrowStr = new Date(today.getTime() + 86400000).toISOString().split("T")[0];

  const prompt = `Parse jadwal dari teks berikut menjadi JSON.
Hari ini: ${todayStr} (${today.toLocaleDateString("id-ID", { weekday: "long" })})
Besok: ${tomorrowStr}
Zona waktu: WITA (UTC+8)

Teks: "${text}"

Return HANYA JSON valid (tanpa penjelasan), format:
{
  "title": "judul event",
  "date": "YYYY-MM-DD",
  "time": "HH:MM" atau null jika tidak ada waktu spesifik,
  "description": "detail tambahan" atau "",
  "location": "lokasi" atau ""
}

Contoh konversi waktu:
- "jam 10 pagi" → "10:00"
- "jam 2 siang" → "14:00"
- "jam setengah 9" → "08:30"
- "besok" → ${tomorrowStr}
- "minggu depan" → tanggal minggu depan dari hari ini
- "tanggal 20" → ${todayStr.substring(0,8)}20 (bulan ini)`;

  try {
    const raw = await askClaude(prompt, { skipMemory: true, skipKnowledge: true, timeout: 20000 });
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (err) {
    console.error("[CALENDAR] Parse error:", err.message);
  }

  return null;
}

// ─── Format list events untuk display ───────────────────
function formatEvents(events, title = "JADWAL") {
  if (events.length === 0) return `📅 <b>${title}</b>\n\nTidak ada event.`;

  let text = `📅 <b>${title}</b>\n━━━━━━━━━━━━━━━\n`;

  let lastDate = null;
  for (const event of events) {
    const start = event.start?.dateTime || event.start?.date;
    const dt = new Date(start);
    const dateStr = dt.toLocaleDateString("id-ID", { weekday: "long", day: "2-digit", month: "long", timeZone: "Asia/Makassar" });
    const timeStr = event.start?.dateTime
      ? dt.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Makassar" })
      : "Sepanjang hari";

    if (dateStr !== lastDate) {
      text += `\n📌 <b>${dateStr}:</b>\n`;
      lastDate = dateStr;
    }

    const loc = event.location ? ` 📍${event.location}` : "";
    text += `🕐 ${timeStr} — ${event.summary}${loc}\n`;
    if (event.description) {
      text += `   <i>${event.description.substring(0, 80)}</i>\n`;
    }
  }

  return text.trim();
}

// ─── Buat reminder otomatis untuk deadline proyek ────────
async function createProyekReminders(proyekName, deadlineDate) {
  const deadline = new Date(deadlineDate);
  const reminders = [
    { days: 30, label: "30 hari" },
    { days: 7, label: "1 minggu" },
    { days: 1, label: "besok" }
  ];

  const created = [];
  for (const r of reminders) {
    const reminderDate = new Date(deadline.getTime() - r.days * 86400000);
    if (reminderDate > new Date()) {
      try {
        const ev = await createEvent(
          `⚠️ ${r.days === 1 ? "Besok" : r.label + " sebelum"} deadline: ${proyekName}`,
          reminderDate.toISOString().split("T")[0],
          null,
          `Deadline proyek ${proyekName}: ${deadline.toLocaleDateString("id-ID")}`
        );
        created.push(ev.summary);
      } catch {}
    }
  }
  return created;
}

module.exports = {
  getAuthUrl,
  setTokenFromCode,
  loadAndSetToken,
  listEvents,
  getTodayEvents,
  getUpcomingDeadlines,
  createEvent,
  updateEvent,
  deleteEvent,
  parseScheduleFromText,
  formatEvents,
  createProyekReminders
};
