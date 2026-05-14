const fs = require("fs-extra");

const TEMPLATES_FILE = "/root/ai-system/memory/contacts/templates.json";

const DEFAULT_TEMPLATES = [
  {
    id: "dok_diterima",
    nama: "Dokumen diterima",
    icon: "✅",
    teks: "Terima kasih, dokumen sudah kami terima dan sedang diproses. Akan kami kabari segera. Salam, TERNION GROUP"
  },
  {
    id: "jadwal_meeting",
    nama: "Jadwal meeting",
    icon: "📅",
    teks: "Halo [nama], kami ingin konfirmasi jadwal pertemuan pada [tanggal] jam [waktu] di [lokasi]. Mohon konfirmasinya. Terima kasih."
  },
  {
    id: "konfirmasi_harga",
    nama: "Konfirmasi harga",
    icon: "💰",
    teks: "Halo [nama], kami konfirmasi harga yang disepakati adalah [harga] untuk [item]. Mohon konfirmasinya. Terima kasih."
  },
  {
    id: "update_progress",
    nama: "Update progress",
    icon: "🏗️",
    teks: "Halo [nama], kami ingin menginformasikan progress terbaru untuk [proyek]. Saat ini sudah mencapai [persentase]%. Ada yang ingin didiskusikan?"
  },
  {
    id: "minta_laporan",
    nama: "Minta laporan",
    icon: "📋",
    teks: "Halo [nama], mohon update progress terbaru untuk [proyek/hal]. Terima kasih."
  }
];

async function loadTemplates() {
  try {
    await fs.ensureFile(TEMPLATES_FILE);
    const data = await fs.readJson(TEMPLATES_FILE).catch(() => null);
    if (!data || !data.templates || data.templates.length === 0) {
      return { templates: DEFAULT_TEMPLATES };
    }
    return data;
  } catch {
    return { templates: DEFAULT_TEMPLATES };
  }
}

async function saveTemplates(data) {
  await fs.ensureFile(TEMPLATES_FILE);
  await fs.writeJson(TEMPLATES_FILE, data, { spaces: 2 });
}

async function getTemplates() {
  const data = await loadTemplates();
  return data.templates;
}

async function getTemplate(id) {
  const data = await loadTemplates();
  return data.templates.find(t => t.id === id) || null;
}

async function addTemplate(nama, teks, icon = "📝") {
  const data = await loadTemplates();
  const id = nama.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "").substring(0, 20);
  data.templates.push({ id, nama, icon, teks });
  await saveTemplates(data);
  return id;
}

module.exports = { getTemplates, getTemplate, addTemplate };
