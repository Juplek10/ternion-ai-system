require("dotenv").config();
const fs = require("fs-extra");
const axios = require("axios");
const { addContact } = require("./contact-manager");

const PENDING_FILE = "/root/ai-system/memory/contacts/pending-registration.json";

// ─── Peta kategori ─────────────────────────────────────
const KATEGORI_MAP = {
  nexus:            { label: "🔺 Nexus",           kategori: "nexus" },
  vector:           { label: "⚙️ Vector",           kategori: "internal",   sub: "vector" },
  scripta:          { label: "📋 Scripta",          kategori: "internal",   sub: "scripta" },
  drafter:          { label: "📐 Drafter",          kategori: "internal",   sub: "drafter" },
  rab:              { label: "📊 RAB",              kategori: "internal",   sub: "rab" },
  kantor:           { label: "🏪 Kantor",           kategori: "internal",   sub: "kantor" },
  kontraktor:       { label: "🏗️ Kontraktor",       kategori: "kontraktor" },
  supplier:         { label: "🚛 Supplier",         kategori: "supplier" },
  vendor:           { label: "💼 Vendor",           kategori: "supplier",   sub: "vendor" },
  mitra:            { label: "🤝 Mitra",            kategori: "relasi",     sub: "mitra" },
  relasi:           { label: "👔 Relasi",           kategori: "relasi" },
  investor:         { label: "💰 Investor",         kategori: "relasi",     sub: "investor" },
  pengepul_mangan:  { label: "⛏️ Pengepul Mangan", kategori: "pengepul",   komoditas: "mangan" },
  pengepul_mutiara: { label: "🦪 Pengepul Mutiara",kategori: "pengepul",   komoditas: "mutiara" },
  petani:           { label: "🌾 Petani",           kategori: "pengepul",   komoditas: "agrikultur" },
  nelayan:          { label: "🐟 Nelayan",          kategori: "pengepul",   komoditas: "laut" },
  dinas:            { label: "🏛️ Dinas/Instansi",  kategori: "pemerintah" },
  lpse:             { label: "📜 LPSE/Pengadaan",  kategori: "pemerintah", sub: "lpse" },
  tni_polri:        { label: "👮 TNI/Polri",        kategori: "pemerintah", sub: "tni_polri" },
  belum_tahu:       { label: "❓ Belum tahu",       kategori: "tidak_dikenal" }
};

const GAYA_BICARA_MAP = {
  nexus: "santai dan strategis", vector: "profesional teknis",
  scripta: "profesional administratif", drafter: "teknis konstruksi",
  rab: "teknis RAB", kantor: "santai profesional",
  kontraktor: "teknis, to the point", supplier: "bisnis sederhana",
  vendor: "bisnis profesional", mitra: "sopan profesional",
  relasi: "sopan profesional", investor: "formal profesional",
  pengepul_mangan: "sederhana, lokal", pengepul_mutiara: "sederhana, lokal",
  petani: "sederhana, lokal", nelayan: "sederhana, lokal",
  dinas: "formal, hormat", lpse: "formal, prosedural",
  tni_polri: "formal, hormat", belum_tahu: "sopan, ramah"
};

// ─── Pending state ─────────────────────────────────────
async function loadPending() {
  try {
    await fs.ensureFile(PENDING_FILE);
    return await fs.readJson(PENDING_FILE).catch(() => ({}));
  } catch { return {}; }
}

async function savePending(data) {
  await fs.ensureFile(PENDING_FILE);
  await fs.writeJson(PENDING_FILE, data, { spaces: 2 });
}

// ─── Start: notif ke Telegram saat kontak baru ─────────
async function startRegistration(nomor, firstMessage) {
  const clean = nomor.replace("@c.us", "").replace("+", "");
  const pending = await loadPending();

  // Jangan registrasi ulang jika sudah ada pending
  if (pending[clean] && pending[clean].step !== "done") return;

  pending[clean] = {
    nomor: clean,
    firstMessage: firstMessage.substring(0, 200),
    step: "awaiting_category",
    kategori_key: null,
    nama: null,
    detail: null,
    created_at: new Date().toISOString()
  };
  await savePending(pending);

  const timeStr = new Date().toLocaleTimeString("id-ID", {
    hour: "2-digit", minute: "2-digit", timeZone: "Asia/Makassar"
  });

  const msg =
    `👤 <b>KONTAK BARU MASUK</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `📱 +${clean}\n` +
    `💬 "${firstMessage.substring(0, 150)}"\n` +
    `⏰ ${timeStr} WITA\n\n` +
    `<b>Simpan sebagai siapa?</b>`;

  try {
    console.log('[NOTIFY]', message) }
    });
  } catch (err) {
    console.error("[IDENTITY] Gagal notif:", err.message);
  }
}

function buildCategoryKeyboard(nomor) {
  const n = nomor.substring(0, 15);
  return [
    [{ text: "🔺 Nexus",      callback_data: `imr:cat:${n}:nexus` },
     { text: "⚙️ Vector",     callback_data: `imr:cat:${n}:vector` },
     { text: "📋 Scripta",    callback_data: `imr:cat:${n}:scripta` }],
    [{ text: "📐 Drafter",    callback_data: `imr:cat:${n}:drafter` },
     { text: "📊 RAB",        callback_data: `imr:cat:${n}:rab` },
     { text: "🏪 Kantor",     callback_data: `imr:cat:${n}:kantor` }],
    [{ text: "🏗️ Kontraktor", callback_data: `imr:cat:${n}:kontraktor` },
     { text: "🚛 Supplier",   callback_data: `imr:cat:${n}:supplier` },
     { text: "💼 Vendor",     callback_data: `imr:cat:${n}:vendor` }],
    [{ text: "🤝 Mitra",      callback_data: `imr:cat:${n}:mitra` },
     { text: "👔 Relasi",     callback_data: `imr:cat:${n}:relasi` },
     { text: "💰 Investor",   callback_data: `imr:cat:${n}:investor` }],
    [{ text: "⛏️ P.Mangan",   callback_data: `imr:cat:${n}:pengepul_mangan` },
     { text: "🦪 P.Mutiara",  callback_data: `imr:cat:${n}:pengepul_mutiara` }],
    [{ text: "🌾 Petani",     callback_data: `imr:cat:${n}:petani` },
     { text: "🐟 Nelayan",    callback_data: `imr:cat:${n}:nelayan` }],
    [{ text: "🏛️ Dinas",      callback_data: `imr:cat:${n}:dinas` },
     { text: "📜 LPSE",       callback_data: `imr:cat:${n}:lpse` },
     { text: "👮 TNI/Polri",  callback_data: `imr:cat:${n}:tni_polri` }],
    [{ text: "❓ Belum tahu", callback_data: `imr:cat:${n}:belum_tahu` },
     { text: "⏭️ Skip dulu",  callback_data: `imr:skip:${n}` }]
  ];
}

function buildConfirmKeyboard(nomor) {
  const n = nomor.substring(0, 15);
  return [
    [{ text: "✅ Simpan",  callback_data: `imr:confirm:${n}` },
     { text: "✏️ Edit",   callback_data: `imr:edit:${n}` },
     { text: "⏭️ Skip",   callback_data: `imr:skip:${n}` }]
  ];
}

function buildConfirmText(data) {
  const kat = KATEGORI_MAP[data.kategori_key] || { label: data.kategori_key };
  return (
    `✅ <b>KONFIRMASI KONTAK</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `👤 Nama: <b>${data.nama}</b>\n` +
    `📱 Nomor: +${data.nomor}\n` +
    `🏷️ Posisi: ${kat.label}\n` +
    (data.detail ? `🏢 Detail: ${data.detail}\n` : ``) +
    `\nSimpan kontak ini?`
  );
}

// ─── Handle category tap ───────────────────────────────
async function handleCategorySelected(nomor, kategoriKey) {
  const pending = await loadPending();
  if (!pending[nomor]) return null;
  const kat = KATEGORI_MAP[kategoriKey];
  if (!kat) return null;
  pending[nomor].kategori_key = kategoriKey;
  pending[nomor].step = "awaiting_name";
  await savePending(pending);
  return `👤 <b>Nama untuk nomor +${nomor}?</b>\n\n<i>Ketik nama lengkap atau panggilan (contoh: Pak Ahmad, Bu Sari)</i>`;
}

// ─── Handle name text ──────────────────────────────────
async function handleNameInput(nomor, nama) {
  const pending = await loadPending();
  if (!pending[nomor] || pending[nomor].step !== "awaiting_name") return null;
  pending[nomor].nama = nama;
  const katKey = pending[nomor].kategori_key;
  const needsDetail = ["kontraktor", "supplier", "vendor", "dinas", "lpse", "tni_polri"].includes(katKey);

  if (needsDetail) {
    pending[nomor].step = "awaiting_detail";
    await savePending(pending);
    if (["kontraktor", "supplier", "vendor"].includes(katKey)) {
      return `🏢 Nama perusahaan <b>${nama}</b>?\n<i>(ketik - jika tidak ada)</i>`;
    } else if (["dinas", "lpse"].includes(katKey)) {
      return `🏛️ Nama dinas/instansi <b>${nama}</b>?`;
    } else if (katKey === "tni_polri") {
      return `🎖️ Pangkat dan satuan <b>${nama}</b>? <i>(ketik - jika tidak perlu)</i>`;
    }
  }

  pending[nomor].step = "awaiting_confirm";
  await savePending(pending);
  return { text: buildConfirmText(pending[nomor]), keyboard: buildConfirmKeyboard(nomor) };
}

// ─── Handle detail text ────────────────────────────────
async function handleDetailInput(nomor, detail) {
  const pending = await loadPending();
  if (!pending[nomor] || pending[nomor].step !== "awaiting_detail") return null;
  pending[nomor].detail = detail === "-" ? null : detail;
  pending[nomor].step = "awaiting_confirm";
  await savePending(pending);
  return { text: buildConfirmText(pending[nomor]), keyboard: buildConfirmKeyboard(nomor) };
}

// ─── Confirm and save ──────────────────────────────────
async function confirmRegistration(nomor) {
  const pending = await loadPending();
  if (!pending[nomor]) return null;
  const data = pending[nomor];
  const katInfo = KATEGORI_MAP[data.kategori_key] || {};

  const contactData = {
    nama: data.nama,
    kategori: katInfo.kategori || "tidak_dikenal",
    sub_kategori: katInfo.sub || null,
    gaya_bicara: GAYA_BICARA_MAP[data.kategori_key] || "sopan, ramah",
    konteks_bisnis: null
  };

  if (katInfo.komoditas) {
    contactData.konteks_bisnis = `Pengepul ${katInfo.komoditas}${data.detail ? ` — ${data.detail}` : ""}`;
  } else if (data.detail) {
    contactData.konteks_bisnis = data.detail;
  }

  await addContact(nomor, contactData);
  delete pending[nomor];
  await savePending(pending);

  return `✅ <b>${data.nama}</b> (${katInfo.label || data.kategori_key}) berhasil didaftarkan.\nAI akan melayani mereka sesuai posisi.`;
}

// ─── Skip ─────────────────────────────────────────────
async function skipRegistration(nomor) {
  const pending = await loadPending();
  delete pending[nomor];
  await savePending(pending);
}

// ─── Reset ke category (edit) ─────────────────────────
async function resetToCategory(nomor) {
  const pending = await loadPending();
  if (!pending[nomor]) return false;
  pending[nomor].step = "awaiting_category";
  pending[nomor].nama = null;
  pending[nomor].detail = null;
  pending[nomor].kategori_key = null;
  await savePending(pending);
  return true;
}

// ─── Getters ───────────────────────────────────────────
async function getPendingState(nomor) {
  const pending = await loadPending();
  return pending[nomor] || null;
}

async function getAllPending() {
  const pending = await loadPending();
  return Object.values(pending);
}

module.exports = {
  startRegistration,
  handleCategorySelected,
  handleNameInput,
  handleDetailInput,
  confirmRegistration,
  skipRegistration,
  resetToCategory,
  getPendingState,
  getAllPending,
  buildCategoryKeyboard,
  buildConfirmKeyboard,
  KATEGORI_MAP
};
