require("dotenv").config();

const fs = require("fs-extra");
const axios = require("axios");

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || "8615852356:AAGzjiONLbkuSKBvXePPwhuKACkCZMC0QaY";
const BRIAN_CHAT_ID = 6935073123;
const DELEGASI_LOG = "/root/ai-system/memory/delegasi-log.json";
const REGISTRY_FILE = "/root/ai-system/memory/contacts/registry.json";

const TOPIK_ROUTING = [
  {
    role: "drafter",
    keywords: ["gambar", "desain", "denah", "tampak", "potongan", "AutoCAD", "sketsa", "layout", "as built", "shop drawing", "gambar kerja", "arsitektur", "struktural", "DED"],
    label: "DRAFTER"
  },
  {
    role: "rab",
    keywords: ["rab", "estimasi", "anggaran", "biaya", "volume", "kuantitas", "AHS", "analisa harga", "harga satuan", "BOQ", "bill of quantity", "hitung biaya"],
    label: "KANTOR RAB"
  },
  {
    role: "scripta",
    keywords: ["administrasi", "surat", "dokumen", "kontrak", "SPK", "berita acara", "BAST", "administrasi tender", "proposal", "laporan", "SPMK", "surat penawaran"],
    label: "SCRIPTA"
  },
  {
    role: "vector",
    keywords: ["lapangan", "progres", "kemajuan", "opname", "foto lapangan", "pengawasan", "mandor", "tukang", "material datang", "bahan di lokasi", "cek lapangan"],
    label: "VECTOR"
  }
];

async function loadDelegasiLog() {
  try {
    await fs.ensureFile(DELEGASI_LOG);
    return await fs.readJson(DELEGASI_LOG).catch(() => ({ log: [] }));
  } catch {
    return { log: [] };
  }
}

async function loadRegistry() {
  try {
    await fs.ensureFile(REGISTRY_FILE);
    return await fs.readJson(REGISTRY_FILE).catch(() => ({ contacts: {} }));
  } catch {
    return { contacts: {} };
  }
}

function detectTopik(teks) {
  const lower = teks.toLowerCase();
  for (const rule of TOPIK_ROUTING) {
    if (rule.keywords.some(k => lower.includes(k))) {
      return rule;
    }
  }
  return null;
}

async function getDelegasiTarget(role) {
  const registry = await loadRegistry();
  const contacts = Object.values(registry.contacts || {});
  const target = contacts.find(c => c.delegasi_role === role && c.kategori === "internal");
  return target || null;
}

async function saveDelegasiLog(entry) {
  const data = await loadDelegasiLog();
  data.log.push(entry);
  if (data.log.length > 500) data.log = data.log.slice(-500);
  await fs.writeJson(DELEGASI_LOG, data, { spaces: 2 });
}

async function routeAndDelegate(nomor, nama, teks) {
  const topik = detectTopik(teks);
  if (!topik) return null;

  const target = await getDelegasiTarget(topik.role);
  const ringkasan = teks.substring(0, 200);

  const logEntry = {
    dari: nomor,
    dari_nama: nama,
    delegasi_ke: target?.nomor || `[${topik.label} belum setup]`,
    topik_role: topik.role,
    topik_label: topik.label,
    ringkasan,
    waktu: new Date().toISOString(),
    status: target ? "dikirim" : "pending_setup"
  };

  await saveDelegasiLog(logEntry);

  if (target?.nomor) {
    return {
      delegasi_ke: target.nomor,
      label: topik.label,
      pesan_untuk_tim: `📋 *DELEGASI dari ${nama}*\n\nPesan: ${ringkasan}\n\n_Diteruskan otomatis oleh TERNION-AI_`
    };
  }

  // Belum setup → notif Brian di Telegram
  await notifyBrianDelegasi(nama, topik.label, ringkasan);
  return {
    delegasi_ke: null,
    label: topik.label,
    pesan_untuk_tim: null
  };
}

async function notifyBrianDelegasi(nama, label, ringkasan) {
  const msg =
    `📋 <b>PESAN PERLU DELEGASI</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `👤 Dari: ${nama}\n` +
    `🏷️ Topik: ${label}\n` +
    `💬 Isi: ${ringkasan}\n\n` +
    `⚠️ Nomor ${label} belum di-setup.\n` +
    `Gunakan: /delegasi [nomor] ${label.toLowerCase()}`;

  try {
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: BRIAN_CHAT_ID,
      text: msg,
      parse_mode: "HTML"
    });
  } catch (err) {
    console.error("[DELEGASI] Gagal notif Brian:", err.message);
  }
}

async function setupDelegasi(nomorTim, role) {
  const registry = await loadRegistry();
  const clean = nomorTim.replace("@c.us", "").replace("+", "");

  if (!registry.contacts[clean]) {
    registry.contacts[clean] = {
      nomor: clean,
      nama: role.toUpperCase(),
      kategori: "internal",
      delegasi_role: role,
      added_at: new Date().toISOString()
    };
  } else {
    registry.contacts[clean].delegasi_role = role;
  }

  await fs.writeJson(REGISTRY_FILE, registry, { spaces: 2 });
  return true;
}

async function listDelegasiLog(limit) {
  const data = await loadDelegasiLog();
  return data.log.slice(-(limit || 20));
}

module.exports = {
  detectTopik,
  routeAndDelegate,
  setupDelegasi,
  getDelegasiTarget,
  listDelegasiLog,
  TOPIK_ROUTING
};
