require("dotenv").config();

const fs = require("fs-extra");
const axios = require("axios");

const APPROVALS_FILE = "/root/ai-system/approvals/pending.json";
const APPROVAL_THRESHOLD_IDR = 50_000_000;

const TRIGGER_KEYWORDS = [
  "setuju", "deal", "oke kita ambil", "kita ambil",
  "konfirmasi", "tanda tangan", "sepakat",
  "kita deal", "kita sepakat", "fix harga",
  "kita ambil", "lanjut", "acc", "disetujui",
  "commit", "kita go", "go ahead", "kita lanjutkan",
  "saya setuju", "kami setuju"
];

const NOMINAL_PATTERN = /(?:rp\.?\s*|idr\s*)?([\d.,]+)\s*(?:juta|jt|miliar|m|ribu|k|rb)?/gi;

function detectApprovalNeeded(teks) {
  const lower = teks.toLowerCase();

  const hasKeyword = TRIGGER_KEYWORDS.some(k => lower.includes(k));
  if (hasKeyword) return { needed: true, reason: "keyword komitmen terdeteksi" };

  const matches = [...teks.matchAll(NOMINAL_PATTERN)];
  for (const m of matches) {
    const angka = parseFloat(m[1].replace(/[.,]/g, ""));
    const satuan = (m[0].match(/juta|jt/i) ? 1_000_000 : m[0].match(/miliar|m\b/i) ? 1_000_000_000 : m[0].match(/ribu|k|rb/i) ? 1_000 : 1);
    const total = angka * satuan;
    if (total >= APPROVAL_THRESHOLD_IDR) {
      return { needed: true, reason: `nilai Rp ${total.toLocaleString("id-ID")} melebihi batas` };
    }
  }

  return { needed: false };
}

async function loadApprovals() {
  try {
    await fs.ensureFile(APPROVALS_FILE);
    return await fs.readJson(APPROVALS_FILE).catch(() => ({ pending: {} }));
  } catch {
    return { pending: {} };
  }
}

async function saveApprovals(data) {
  await fs.ensureFile(APPROVALS_FILE);
  await fs.writeJson(APPROVALS_FILE, data, { spaces: 2 });
}

async function createApproval(nomor, nama, konteks, pertanyaan) {
  const data = await loadApprovals();
  const id = `APR_${Date.now().toString(36).toUpperCase()}`;

  data.pending[id] = {
    id,
    nomor,
    nama,
    konteks: konteks.substring(0, 500),
    pertanyaan,
    status: "pending",
    created_at: new Date().toISOString(),
    resolved_at: null,
    resolution: null,
    alasan: null
  };

  await saveApprovals(data);
  await notifyBrianApproval(data.pending[id]);
  return id;
}

async function notifyBrianApproval(approval) {
  const { getContact } = require("./contact-manager");
  const kontak = await getContact(approval.nomor).catch(() => null);
  const posisi = kontak?.kategori ? `(${kontak.kategori})` : "";

  const msg =
    `⚡ <b>PERLU KEPUTUSAN</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `👤 Dari: <b>${approval.nama}</b> ${posisi}\n` +
    `📱 +${approval.nomor}\n` +
    `💬 Konteks: ${approval.konteks.substring(0, 250)}\n` +
    `❓ Yang diputuskan: ${approval.pertanyaan}`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: "✅ Setuju",       callback_data: `apv:ok:${approval.id}` },
        { text: "❌ Tolak",        callback_data: `apv:rej:${approval.id}` }
      ],
      [
        { text: "⏸️ Tunda",       callback_data: `apv:tnd:${approval.id}` },
        { text: "💬 Balas Manual", callback_data: `apv:rply:${approval.id}` }
      ]
    ]
  };

  try {
    console.log('[NOTIFY]', message);
  } catch (err) {
    console.error("[APPROVAL] Gagal notif Brian:", err.message);
  }
}

async function resolveApproval(id, status, alasan) {
  const data = await loadApprovals();
  if (!data.pending[id]) return null;

  data.pending[id].status = status;
  data.pending[id].resolved_at = new Date().toISOString();
  data.pending[id].resolution = status;
  data.pending[id].alasan = alasan || null;

  await saveApprovals(data);
  return data.pending[id];
}

async function getApproval(id) {
  const data = await loadApprovals();
  return data.pending[id] || null;
}

async function listPendingApprovals() {
  const data = await loadApprovals();
  return Object.values(data.pending).filter(a => a.status === "pending");
}

function getApprovalPendingResponse() {
  return "Baik, saya koordinasikan dulu dengan Pak Brian.\nTunggu konfirmasi dalam 1x24 jam ya. 🙏";
}

function getApproveResponse(detail) {
  return `Pak Brian sudah konfirmasi. ${detail || "Silakan dilanjutkan."} ✅`;
}

function getRejectResponse(alasan) {
  return `Mohon maaf, belum bisa dilanjutkan saat ini.${alasan ? "\n\nAlasan: " + alasan : ""} 🙏`;
}

function getTundaResponse() {
  return "Masih dalam pertimbangan. Akan ada kabar selanjutnya. 🙏";
}

module.exports = {
  detectApprovalNeeded,
  createApproval,
  resolveApproval,
  getApproval,
  listPendingApprovals,
  getApprovalPendingResponse,
  getApproveResponse,
  getRejectResponse,
  getTundaResponse,
  TRIGGER_KEYWORDS
};
