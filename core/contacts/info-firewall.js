require("dotenv").config();

const axios = require("axios");

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || "8615852356:AAGzjiONLbkuSKBvXePPwhuKACkCZMC0QaY";
const BRIAN_CHAT_ID = 6935073123;

const BLOCKED_INFO = [
  "margin keuntungan", "margin profit", "berapa margin",
  "omzet", "omset",
  "pendapatan", "penghasilan",
  "profit bersih", "laba bersih", "laba kotor",
  "modal usaha", "berapa modal",
  "hutang", "piutang",
  "gaji karyawan", "gaji pegawai", "gaji tim",
  "biaya operasional",
  "strategi bisnis internal",
  "data keuangan perusahaan",
  "harga penawaran ke klien lain",
  "nama klien lain", "klien siapa saja",
  "kondisi keuangan",
  "berapa untung", "untung berapa",
  "cashflow", "cash flow",
  "neraca keuangan", "laporan keuangan"
];

const WHITELIST_KONTRAKTOR = [
  "spesifikasi teknis", "volume pekerjaan", "jadwal proyek",
  "metode pembayaran", "termin", "jenis material", "mutu beton",
  "gambar kerja", "shop drawing", "as built", "progress",
  "bobot pekerjaan", "rab proyek", "schedule"
];

const WHITELIST_SUPPLIER = [
  "harga material", "harga barang", "stok material",
  "ketersediaan", "lead time", "pengiriman", "spesifikasi produk",
  "daftar harga", "price list", "minimum order", "diskon volume"
];

const WHITELIST_PENGEPUL = [
  "harga komoditas", "harga mangan", "harga bijih", "harga pasir",
  "tonase", "kualitas", "kadar", "lokasi", "jarak", "biaya angkut",
  "jadwal pengambilan", "pembayaran komoditas"
];

const WHITELIST_PEMERINTAH = [
  "tender", "lelang", "pengadaan", "syarat dokumen",
  "spesifikasi teknis tender", "jadwal tender", "aanwijzing",
  "masa sanggah", "kontrak", "addendum"
];

function isInfoSensitif(teks) {
  const lower = teks.toLowerCase();
  return BLOCKED_INFO.some(kata => lower.includes(kata));
}

function isAksesDisetujui(teks, kategori) {
  const lower = teks.toLowerCase();
  switch (kategori) {
    case "nexus":
      return true;
    case "internal":
      return true;
    case "kontraktor":
      if (isInfoSensitif(lower)) return false;
      return WHITELIST_KONTRAKTOR.some(k => lower.includes(k)) || true;
    case "supplier":
      if (isInfoSensitif(lower)) return false;
      return WHITELIST_SUPPLIER.some(k => lower.includes(k)) || true;
    case "pengepul":
      if (isInfoSensitif(lower)) return false;
      return WHITELIST_PENGEPUL.some(k => lower.includes(k)) || true;
    case "pemerintah":
      if (isInfoSensitif(lower)) return false;
      return WHITELIST_PEMERINTAH.some(k => lower.includes(k)) || true;
    case "relasi":
      return !isInfoSensitif(lower);
    default:
      return !isInfoSensitif(lower);
  }
}

function getBlockedKeywords(teks) {
  const lower = teks.toLowerCase();
  return BLOCKED_INFO.filter(kata => lower.includes(kata));
}

async function alertBrianInfoSensitif(nama, kategori, pertanyaan) {
  const msg =
    `🔒 <b>INFO SENSITIF DIMINTA</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `👤 Dari: ${nama} (${kategori})\n` +
    `❓ Yang ditanya: ${pertanyaan.substring(0, 200)}\n` +
    `✅ Sudah diblok otomatis`;

  try {
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: BRIAN_CHAT_ID,
      text: msg,
      parse_mode: "HTML"
    });
  } catch (err) {
    console.error("[FIREWALL] Gagal alert Brian:", err.message);
  }
}

function getBlockedResponse() {
  return "Untuk informasi tersebut, perlu koordinasi dulu dengan Pak Brian. Saya sudah sampaikan ke beliau ya. 🙏";
}

async function checkAndFilter(teks, kontak) {
  const kategori = kontak?.kategori || "tidak_dikenal";
  const nama = kontak?.nama || kontak?.nomor || "Tidak dikenal";

  if (isInfoSensitif(teks) && kategori !== "nexus" && kategori !== "internal") {
    const keywords = getBlockedKeywords(teks);
    await alertBrianInfoSensitif(nama, kategori, teks);
    return {
      blocked: true,
      reason: keywords.join(", "),
      response: getBlockedResponse()
    };
  }

  if (!isAksesDisetujui(teks, kategori)) {
    await alertBrianInfoSensitif(nama, kategori, teks);
    return {
      blocked: true,
      reason: "info sensitif terdeteksi",
      response: getBlockedResponse()
    };
  }

  return { blocked: false };
}

module.exports = {
  checkAndFilter,
  isInfoSensitif,
  isAksesDisetujui,
  alertBrianInfoSensitif,
  getBlockedResponse,
  BLOCKED_INFO
};
