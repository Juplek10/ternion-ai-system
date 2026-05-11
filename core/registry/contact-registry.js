require("dotenv").config();

const fs = require("fs-extra");

const KONTAK_FILE = "/root/ai-system/memory/kontak.json";

async function loadKontak() {
  try {
    await fs.ensureFile(KONTAK_FILE);
    const data = await fs.readJson(KONTAK_FILE).catch(() => null);
    if (!data || !Array.isArray(data.entries)) return { domain: "kontak", entries: [], last_updated: new Date().toISOString() };
    return data;
  } catch {
    return { domain: "kontak", entries: [], last_updated: new Date().toISOString() };
  }
}

async function saveKontak(data) {
  data.last_updated = new Date().toISOString();
  await fs.ensureFile(KONTAK_FILE);
  await fs.writeJson(KONTAK_FILE, data, { spaces: 2 });
  // Async backup
  require("../integrations/drive-backup").uploadFile(KONTAK_FILE, "CORE-SYSTEM/memory").catch(() => {});
}

async function tambahKontak(nama, perusahaan, telp, catatan) {
  const data = await loadKontak();
  const id = Date.now();
  data.entries.push({
    id, nama, perusahaan: perusahaan || "", telp: telp || "", catatan: catatan || "",
    added_at: new Date().toISOString()
  });
  await saveKontak(data);
  return id;
}

async function cariKontak(query) {
  const data = await loadKontak();
  const q = query.toLowerCase();
  return data.entries.filter(e =>
    e.nama.toLowerCase().includes(q) ||
    (e.perusahaan || "").toLowerCase().includes(q) ||
    (e.catatan || "").toLowerCase().includes(q)
  );
}

async function listKontak() {
  const data = await loadKontak();
  return data.entries;
}

function formatKontak(k, index) {
  return `${index + 1}. <b>${k.nama}</b>${k.perusahaan ? ` — ${k.perusahaan}` : ""}\n   📞 ${k.telp || "N/A"}\n   📝 ${k.catatan || "-"}`;
}

module.exports = { tambahKontak, cariKontak, listKontak, formatKontak };
