require("dotenv").config();

const axios = require("axios");
const fs = require("fs-extra");

const SEEN_FILE = "/root/ai-system/memory/lpse-seen.json";
const CHECK_INTERVAL = 6 * 60 * 60 * 1000; // 6 jam

// Keyword filter: hanya tampilkan yang relevan untuk TERNION
const KEYWORDS = [
  "konstruksi", "gedung", "jalan", "jembatan", "drainase",
  "pengadaan", "konsultansi", "perencanaan", "pengawasan",
  "bangunan", "infrastruktur", "sipil", "arsitektur"
];

async function sendTelegram(message) {
  console.log('[NOTIFY]', message.substring(0, 100));
}

async function loadSeen() {
  try {
    await fs.ensureFile(SEEN_FILE);
    const data = await fs.readJson(SEEN_FILE).catch(() => []);
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}

async function saveSeen(ids) {
  await fs.ensureFile(SEEN_FILE);
  const trimmed = ids.slice(-500);
  await fs.writeJson(SEEN_FILE, trimmed, { spaces: 2 });
}

// ─── Scrape LPSE NTT via API publik ─────────────────────
async function fetchLPSE() {
  try {
    // LPSE NTT menggunakan API standar SPSE 4.x
    const res = await axios.get("https://lpse.nttprov.go.id/eproc4/api/lelang/list", {
      params: { limit: 20, page: 1 },
      timeout: 20000,
      headers: { "User-Agent": "Mozilla/5.0 TernionAI/1.0" }
    });
    return res.data?.data || res.data?.list || res.data || [];
  } catch (err) {
    console.error("[LPSE] Gagal fetch LPSE:", err.message);
    return [];
  }
}

function isRelevant(tender) {
  const name = (tender.name || tender.nama_paket || tender.namaPaket || "").toLowerCase();
  return KEYWORDS.some(k => name.includes(k));
}

function formatTender(tender) {
  const nama = tender.name || tender.nama_paket || tender.namaPaket || "N/A";
  const hps  = tender.hps ? `Rp ${Number(tender.hps).toLocaleString("id-ID")}` : "N/A";
  const dead = tender.tanggal_akhir_penawaran || tender.tanggalAkhirPenawaran || "N/A";
  const id   = tender.id || tender.kode_tender || "";
  const link = id ? `https://lpse.nttprov.go.id/eproc4/lelang/${id}` : "https://lpse.nttprov.go.id";

  return (
`🏛️ <b>TENDER BARU LPSE NTT</b>
━━━━━━━━━━━━━━━━━━━
📋 ${nama}
💰 HPS: ${hps}
📅 Deadline: ${dead}
🔗 ${link}`
  );
}

async function checkLPSE() {
  console.log("[LPSE] Cek tender baru...");
  const tenders = await fetchLPSE();
  if (!Array.isArray(tenders) || tenders.length === 0) {
    console.log("[LPSE] Tidak ada data atau endpoint tidak tersedia");
    return;
  }

  const seen = await loadSeen();
  const newSeen = [...seen];
  let alertCount = 0;

  for (const tender of tenders) {
    const id = String(tender.id || tender.kode_tender || JSON.stringify(tender).substring(0, 50));
    if (seen.includes(id)) continue;
    newSeen.push(id);
    if (!isRelevant(tender)) continue;

    await sendTelegram(formatTender(tender));
    alertCount++;
    await new Promise(r => setTimeout(r, 1000)); // jeda antar pesan
  }

  await saveSeen(newSeen);
  console.log(`[LPSE] Selesai. Tender relevan baru: ${alertCount}`);
}

console.log("[LPSE-MONITOR] Berjalan — cek setiap 6 jam");
checkLPSE();
setInterval(checkLPSE, CHECK_INTERVAL);

process.once("SIGINT", () => process.exit(0));
process.once("SIGTERM", () => process.exit(0));
