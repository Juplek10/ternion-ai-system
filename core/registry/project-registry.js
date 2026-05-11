require("dotenv").config();

const fs = require("fs-extra");

const PROYEK_FILE = "/root/ai-system/memory/proyek.json";

async function loadProyek() {
  try {
    await fs.ensureFile(PROYEK_FILE);
    const data = await fs.readJson(PROYEK_FILE).catch(() => null);
    if (!data || !Array.isArray(data.entries)) return { domain: "proyek", entries: [], last_updated: new Date().toISOString() };
    return data;
  } catch {
    return { domain: "proyek", entries: [], last_updated: new Date().toISOString() };
  }
}

async function saveProyek(data) {
  data.last_updated = new Date().toISOString();
  await fs.ensureFile(PROYEK_FILE);
  await fs.writeJson(PROYEK_FILE, data, { spaces: 2 });
  require("../integrations/drive-backup").uploadFile(PROYEK_FILE, "CORE-SYSTEM/memory").catch(() => {});
}

function sisaHari(deadline) {
  if (!deadline) return null;
  const dl = new Date(deadline).getTime();
  const now = Date.now();
  return Math.ceil((dl - now) / (1000 * 60 * 60 * 24));
}

async function tambahProyek(nama, nilai, deadline, status) {
  const data = await loadProyek();
  const id = Date.now();
  data.entries.push({
    id, nama,
    nilai: nilai || "N/A",
    deadline: deadline || null,
    status: status || "tender",
    added_at: new Date().toISOString()
  });
  await saveProyek(data);
  return id;
}

async function updateProyek(nama, statusBaru) {
  const data = await loadProyek();
  const q = nama.toLowerCase();
  let updated = 0;
  for (const p of data.entries) {
    if (p.nama.toLowerCase().includes(q)) {
      p.status = statusBaru;
      p.updated_at = new Date().toISOString();
      updated++;
    }
  }
  if (updated > 0) await saveProyek(data);
  return updated;
}

async function listProyek() {
  const data = await loadProyek();
  return data.entries;
}

async function detailProyek(nama) {
  const data = await loadProyek();
  const q = nama.toLowerCase();
  return data.entries.filter(p => p.nama.toLowerCase().includes(q));
}

function formatProyek(p, index) {
  const sisa = sisaHari(p.deadline);
  const sisaStr = sisa !== null
    ? (sisa < 0 ? `⚠️ LEWAT ${Math.abs(sisa)} hari` : sisa <= 7 ? `🔴 ${sisa} hari lagi` : `${sisa} hari`)
    : "N/A";

  const nilaiStr = typeof p.nilai === "number"
    ? `Rp ${p.nilai.toLocaleString("id-ID")}`
    : (p.nilai || "N/A");

  return (
`${index + 1}. <b>${p.nama}</b>
   💰 Nilai: ${nilaiStr}
   📅 Deadline: ${p.deadline || "N/A"}
   📊 Status: ${p.status || "N/A"}
   ⏰ Sisa: ${sisaStr}`
  );
}

module.exports = { tambahProyek, updateProyek, listProyek, detailProyek, formatProyek };
