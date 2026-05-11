require("dotenv").config();

const fs = require("fs-extra");
const path = require("path");

const STATES_DIR = "/root/ai-system/memory/wa-states";
const TIMEOUT_MS = 30 * 60 * 1000;

// ─── Load state percakapan ─────────────────────────────────
async function loadState(nomor) {
  const clean = nomor.replace("@c.us", "").replace("+", "");
  const file = path.join(STATES_DIR, `${clean}.json`);
  try {
    await fs.ensureDir(STATES_DIR);
    const data = await fs.readJson(file).catch(() => null);
    if (!data) return null;
    if (Date.now() - new Date(data.updated_at).getTime() > TIMEOUT_MS) {
      await clearState(nomor);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

async function saveState(nomor, state) {
  const clean = nomor.replace("@c.us", "").replace("+", "");
  const file = path.join(STATES_DIR, `${clean}.json`);
  state.updated_at = new Date().toISOString();
  state.nomor = clean;
  await fs.ensureDir(STATES_DIR);
  await fs.writeJson(file, state, { spaces: 2 });
}

async function clearState(nomor) {
  const clean = nomor.replace("@c.us", "").replace("+", "");
  const file = path.join(STATES_DIR, `${clean}.json`);
  try { await fs.remove(file); } catch {}
}

// ─── Flow RAB ──────────────────────────────────────────────
const RAB_FLOW = {
  name: "collecting_rab",
  steps: [
    { key: "panjang", question: "Siap! Berapa panjang pagar (meter)?" },
    { key: "tinggi", question: "Tinggi pagar berapa meter?" },
    { key: "spesifikasi", question: "Spesifikasi: beton biasa atau precast?" }
  ]
};

const AHS_FLOW = {
  name: "collecting_ahs",
  steps: [
    { key: "pekerjaan", question: "Jenis pekerjaan apa yang perlu dianalisa?" },
    { key: "satuan", question: "Satuan pekerjaan: m², m³, unit, atau lainnya?" },
    { key: "lokasi", question: "Lokasi proyek (kota/kabupaten)?" }
  ]
};

// ─── Deteksi intent awal ───────────────────────────────────
function detectFlowTrigger(teks) {
  const lower = teks.toLowerCase();
  if (lower.includes("rab pagar") || lower.includes("harga pagar") || lower.includes("estimasi pagar")) {
    return { flow: "rab_pagar", firstStep: "Siap! Berapa panjang pagar yang direncanakan (meter)?" };
  }
  if (lower.includes("rab ") || lower.includes("minta rab") || lower.includes("buat rab") || lower.includes("hitung rab")) {
    return { flow: "rab_umum", firstStep: "Siap! Sebutkan nama/jenis pekerjaan yang perlu di-RAB?" };
  }
  if (lower.includes("ahs ") || lower.includes("minta ahs") || lower.includes("analisa harga")) {
    return { flow: "ahs", firstStep: AHS_FLOW.steps[0].question };
  }
  if (lower.includes("draft ") || lower.includes("buat surat") || lower.includes("surat ")) {
    return { flow: "draft", firstStep: "Jenis surat/dokumen apa yang diperlukan?" };
  }
  return null;
}

// ─── Proses langkah dalam flow ─────────────────────────────
async function processStep(nomor, teks) {
  const state = await loadState(nomor);
  if (!state) return null;

  state.data[state.current_key] = teks;
  state.step++;

  let steps = [];
  if (state.flow === "rab_pagar") {
    steps = [
      { key: "panjang", label: "panjang" },
      { key: "tinggi", label: "tinggi" },
      { key: "spesifikasi", label: "spesifikasi" }
    ];
  } else if (state.flow === "rab_umum") {
    steps = [
      { key: "pekerjaan", label: "nama pekerjaan" },
      { key: "volume", label: "volume/kuantitas" },
      { key: "lokasi", label: "lokasi proyek" }
    ];
  } else if (state.flow === "ahs") {
    steps = AHS_FLOW.steps;
  } else if (state.flow === "draft") {
    steps = [
      { key: "jenis", label: "jenis dokumen" },
      { key: "tujuan", label: "ditujukan kepada siapa?" },
      { key: "isi_utama", label: "isi pokok/poin utama dokumen?" }
    ];
  }

  if (state.step < steps.length) {
    state.current_key = steps[state.step].key;
    const q = state.questions?.[state.step] || `${steps[state.step].label}?`;
    await saveState(nomor, state);
    return { done: false, question: q };
  }

  // Flow selesai → generate output
  const collectedData = state.data;
  await clearState(nomor);
  return { done: true, flow: state.flow, data: collectedData };
}

// ─── Mulai flow baru ───────────────────────────────────────
async function startFlow(nomor, flowInfo) {
  let steps = [];
  if (flowInfo.flow === "rab_pagar") {
    steps = [
      { key: "panjang", q: "Siap! Berapa panjang pagar (meter)?" },
      { key: "tinggi", q: "Tinggi pagar berapa meter?" },
      { key: "spesifikasi", q: "Spesifikasi: beton biasa atau precast?" }
    ];
  } else if (flowInfo.flow === "rab_umum") {
    steps = [
      { key: "pekerjaan", q: "Siap! Nama/jenis pekerjaan apa?" },
      { key: "volume", q: "Volume atau kuantitas pekerjaan?" },
      { key: "lokasi", q: "Lokasi proyek (kota/kabupaten)?" }
    ];
  } else if (flowInfo.flow === "ahs") {
    steps = AHS_FLOW.steps.map(s => ({ key: s.key, q: s.question }));
  } else if (flowInfo.flow === "draft") {
    steps = [
      { key: "jenis", q: "Jenis dokumen: surat penawaran, SPK, berita acara, atau lainnya?" },
      { key: "tujuan", q: "Ditujukan kepada siapa / instansi apa?" },
      { key: "isi_utama", q: "Poin utama yang perlu dicantumkan?" }
    ];
  }

  if (steps.length === 0) return null;

  const state = {
    flow: flowInfo.flow,
    step: 0,
    current_key: steps[0].key,
    questions: steps.map(s => s.q),
    data: {},
    updated_at: new Date().toISOString()
  };

  await saveState(nomor, state);
  return steps[0].q;
}

// ─── Generate RAB dari data flow ──────────────────────────
async function generateFromFlow(flowResult) {
  const { flow, data } = flowResult;
  const askClaude = require("../providers/claude-pipe");

  let prompt = "";
  if (flow === "rab_pagar") {
    prompt = `Buat RAB pagar beton dengan spesifikasi:
- Panjang: ${data.panjang || "?"} meter
- Tinggi: ${data.tinggi || "?"} meter
- Spesifikasi: ${data.spesifikasi || "beton biasa"}

Berikan RAB lengkap dengan kolom: No, Uraian Pekerjaan, Volume, Satuan, Harga Satuan, Jumlah.
Format tabel yang rapi dan mudah dibaca via WhatsApp.`;
  } else if (flow === "rab_umum") {
    prompt = `Buat RAB untuk pekerjaan:
- Pekerjaan: ${data.pekerjaan || "?"}
- Volume: ${data.volume || "?"}
- Lokasi: ${data.lokasi || "NTT"}

Berikan estimasi RAB lengkap dalam format yang mudah dibaca via WhatsApp.`;
  } else if (flow === "ahs") {
    prompt = `Buat Analisa Harga Satuan (AHS) untuk:
- Pekerjaan: ${data.pekerjaan || "?"}
- Satuan: ${data.satuan || "m²"}
- Lokasi: ${data.lokasi || "NTT"}

Format AHS standar yang lengkap.`;
  } else if (flow === "draft") {
    prompt = `Buat ${data.jenis || "dokumen"} untuk/kepada ${data.tujuan || "pihak terkait"}.
Isi utama: ${data.isi_utama || "sesuai standar"}.
Format surat resmi yang baik.`;
  }

  if (!prompt) return "Data tidak lengkap untuk generate output.";

  try {
    return await askClaude(prompt, {
      systemContext: "Kamu adalah asisten konstruksi TERNION GROUP. Buat output yang konkret dan langsung bisa digunakan."
    });
  } catch (err) {
    return `Gagal generate: ${err.message}`;
  }
}

module.exports = {
  loadState,
  saveState,
  clearState,
  detectFlowTrigger,
  processStep,
  startFlow,
  generateFromFlow
};
