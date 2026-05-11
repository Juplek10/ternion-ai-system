require("dotenv").config();

const fs = require("fs-extra");
const path = require("path");

const REGISTRY_FILE = "/root/ai-system/memory/contacts/registry.json";

const KATEGORI_CONFIG = {
  nexus: {
    bahasa: "santai dan strategis",
    akses: ["semua"],
    approval: false,
    info_sensitif: false,
    master_switch: true
  },
  internal: {
    bahasa: "santai profesional",
    akses: ["sesuai bidang"],
    approval: true,
    info_sensitif: false,
    master_switch: false
  },
  kontraktor: {
    bahasa: "teknis, to the point",
    akses: ["spesifikasi teknis", "volume pekerjaan", "jadwal proyek", "metode pembayaran"],
    approval: true,
    info_sensitif: true,
    master_switch: false
  },
  supplier: {
    bahasa: "bisnis sederhana",
    akses: ["info material"],
    approval: true,
    info_sensitif: true,
    auto_extract_harga: true,
    master_switch: false
  },
  pengepul: {
    bahasa: "sederhana, lokal",
    akses: ["info komoditas"],
    approval: true,
    info_sensitif: true,
    auto_extract_harga: true,
    master_switch: false
  },
  relasi: {
    bahasa: "sopan profesional",
    akses: ["info umum TERNION"],
    approval: true,
    info_sensitif: true,
    master_switch: false
  },
  pemerintah: {
    bahasa: "formal, hormat",
    akses: ["info tender", "info proyek"],
    approval: true,
    info_sensitif: true,
    master_switch: false
  },
  tidak_dikenal: {
    bahasa: "sopan, ramah",
    akses: ["sangat terbatas"],
    approval: true,
    info_sensitif: true,
    auto_notif_brian: true,
    master_switch: false
  }
};

async function loadRegistry() {
  try {
    await fs.ensureFile(REGISTRY_FILE);
    const data = await fs.readJson(REGISTRY_FILE).catch(() => null);
    if (!data || !data.contacts) return { contacts: {}, last_updated: new Date().toISOString() };
    return data;
  } catch {
    return { contacts: {}, last_updated: new Date().toISOString() };
  }
}

async function saveRegistry(data) {
  data.last_updated = new Date().toISOString();
  await fs.ensureFile(REGISTRY_FILE);
  await fs.writeJson(REGISTRY_FILE, data, { spaces: 2 });
  try {
    const { uploadFile } = require("../integrations/drive-backup");
    uploadFile(REGISTRY_FILE, "CORE-SYSTEM/memory").catch(() => {});
  } catch {}
}

async function getContact(nomor) {
  const clean = nomor.replace("@c.us", "").replace("+", "");
  const registry = await loadRegistry();
  return registry.contacts[clean] || null;
}

async function getContactOrDefault(nomor) {
  const kontak = await getContact(nomor);
  if (kontak) return kontak;
  return {
    nomor: nomor.replace("@c.us", "").replace("+", ""),
    nama: null,
    panggilan: null,
    role: "TAMU",
    kategori: "tidak_dikenal",
    sub_kategori: null,
    bahasa: "indonesia",
    gaya_bicara: "sopan, ramah",
    boleh_akses: ["sangat terbatas"],
    info_sensitif: true,
    perlu_approval: true,
    konteks_bisnis: null,
    history_proyek: [],
    history_harga: [],
    follow_up_pending: [],
    last_interaction: "",
    total_interactions: 0,
    trust_level: "rendah",
    delegasi_ke: null
  };
}

async function addContact(nomor, data) {
  const clean = nomor.replace("@c.us", "").replace("+", "");
  const registry = await loadRegistry();
  const kategoriCfg = KATEGORI_CONFIG[data.kategori] || KATEGORI_CONFIG.tidak_dikenal;

  registry.contacts[clean] = {
    nomor: clean,
    nama: data.nama || null,
    panggilan: data.panggilan || null,
    role: data.role || data.kategori?.toUpperCase() || "TAMU",
    kategori: data.kategori || "tidak_dikenal",
    sub_kategori: data.sub_kategori || null,
    bahasa: data.bahasa || "indonesia",
    gaya_bicara: data.gaya_bicara || kategoriCfg.bahasa,
    boleh_akses: data.boleh_akses || kategoriCfg.akses,
    info_sensitif: data.info_sensitif !== undefined ? data.info_sensitif : kategoriCfg.info_sensitif,
    perlu_approval: data.perlu_approval !== undefined ? data.perlu_approval : kategoriCfg.approval,
    konteks_bisnis: data.konteks_bisnis || null,
    history_proyek: [],
    history_harga: [],
    follow_up_pending: [],
    last_interaction: new Date().toISOString(),
    total_interactions: 0,
    trust_level: data.trust_level || "sedang",
    delegasi_ke: data.delegasi_ke || null,
    master_switch: kategoriCfg.master_switch || false,
    added_at: new Date().toISOString()
  };

  await saveRegistry(registry);
  return registry.contacts[clean];
}

async function updateContact(nomor, fields) {
  const clean = nomor.replace("@c.us", "").replace("+", "");
  const registry = await loadRegistry();
  if (!registry.contacts[clean]) return null;
  Object.assign(registry.contacts[clean], fields);
  await saveRegistry(registry);
  return registry.contacts[clean];
}

async function updateInteraction(nomor, message) {
  const clean = nomor.replace("@c.us", "").replace("+", "");
  const registry = await loadRegistry();
  if (registry.contacts[clean]) {
    registry.contacts[clean].last_interaction = new Date().toISOString();
    registry.contacts[clean].total_interactions = (registry.contacts[clean].total_interactions || 0) + 1;
    await saveRegistry(registry);
  }
}

async function listContacts(kategori) {
  const registry = await loadRegistry();
  let list = Object.values(registry.contacts);
  if (kategori) list = list.filter(c => c.kategori === kategori);
  return list;
}

async function removeContact(nomor) {
  const clean = nomor.replace("@c.us", "").replace("+", "");
  const registry = await loadRegistry();
  if (!registry.contacts[clean]) return false;
  delete registry.contacts[clean];
  await saveRegistry(registry);
  return true;
}

function getKategoriConfig(kategori) {
  return KATEGORI_CONFIG[kategori] || KATEGORI_CONFIG.tidak_dikenal;
}

function formatContactInfo(k) {
  const icon = {
    nexus: "👑", internal: "🏢", kontraktor: "🔨", supplier: "📦",
    pengepul: "⛏️", relasi: "🤝", pemerintah: "🏛️", tidak_dikenal: "❓"
  }[k.kategori] || "👤";

  return (
    `${icon} *${k.nama || k.nomor}*\n` +
    `📞 ${k.nomor}\n` +
    `🏷️ ${k.kategori?.toUpperCase()} | ${k.role}\n` +
    `💬 Gaya: ${k.gaya_bicara}\n` +
    `✅ Interaksi: ${k.total_interactions}x\n` +
    `🕐 Terakhir: ${k.last_interaction ? k.last_interaction.split("T")[0] : "belum"}`
  );
}

module.exports = {
  loadRegistry,
  getContact,
  getContactOrDefault,
  addContact,
  updateContact,
  updateInteraction,
  listContacts,
  removeContact,
  getKategoriConfig,
  formatContactInfo,
  KATEGORI_CONFIG
};
