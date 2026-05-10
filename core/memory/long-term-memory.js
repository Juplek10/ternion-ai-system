require("dotenv").config();

const fs = require("fs-extra");

const MEMORY_FILE = "/root/ai-system/memory/long-term.json";

// ─── Template struktur memory ───────────────────────────
const DEFAULT_MEMORY = {
  facts: {
    brian: [],
    business: [],
    decisions: [],
    contacts: [],
    projects: []
  },
  conversations: [],
  learnings: []
};

// ─── Load memory ────────────────────────────────────────
async function loadMemory() {
  try {
    await fs.ensureFile(MEMORY_FILE);
    const data = await fs.readJson(MEMORY_FILE).catch(() => null);
    if (!data || typeof data !== "object") return { ...DEFAULT_MEMORY };
    return {
      facts: {
        brian: data.facts?.brian || [],
        business: data.facts?.business || [],
        decisions: data.facts?.decisions || [],
        contacts: data.facts?.contacts || [],
        projects: data.facts?.projects || []
      },
      conversations: data.conversations || [],
      learnings: data.learnings || []
    };
  } catch (err) {
    return { ...DEFAULT_MEMORY };
  }
}

// ─── Simpan memory ───────────────────────────────────────
async function saveMemory(mem) {
  await fs.ensureFile(MEMORY_FILE);
  await fs.writeJson(MEMORY_FILE, mem, { spaces: 2 });
}

// ─── Tambah fakta ────────────────────────────────────────
async function addFact(category, content) {
  const mem = await loadMemory();
  if (!mem.facts[category]) mem.facts[category] = [];

  const entry = {
    content,
    added_at: new Date().toISOString()
  };

  // Cegah duplikat
  const isDuplicate = mem.facts[category].some(
    f => f.content.toLowerCase() === content.toLowerCase()
  );
  if (!isDuplicate) {
    mem.facts[category].push(entry);
    // Batasi 100 per kategori
    if (mem.facts[category].length > 100) {
      mem.facts[category] = mem.facts[category].slice(-100);
    }
    await saveMemory(mem);
  }
  return mem;
}

// ─── Hapus fakta berdasar topik ─────────────────────────
async function forgetTopic(topic) {
  const mem = await loadMemory();
  const lowerTopic = topic.toLowerCase();
  let deleted = 0;

  for (const cat of Object.keys(mem.facts)) {
    const before = mem.facts[cat].length;
    mem.facts[cat] = mem.facts[cat].filter(
      f => !f.content.toLowerCase().includes(lowerTopic)
    );
    deleted += before - mem.facts[cat].length;
  }

  mem.learnings = mem.learnings.filter(
    l => !l.content.toLowerCase().includes(lowerTopic)
  );

  await saveMemory(mem);
  return deleted;
}

// ─── Auto-detect dan simpan fakta dari percakapan ───────
async function autoExtract(userMessage) {
  const msg = userMessage.toLowerCase();

  // Deteksi nama perusahaan/kontak baru
  const companyPattern = /(?:PT|CV|UD|firma|perusahaan|vendor|supplier|kontraktor)\s+([A-Z][^\s,]+(?:\s[A-Z][^\s,]+)*)/gi;
  const matches = userMessage.matchAll(companyPattern);
  for (const m of matches) {
    await addFact("contacts", `Perusahaan: ${m[0].trim()}`);
  }

  // Deteksi nilai proyek
  const valuePattern = /(?:nilai|anggaran|budget|kontrak|harga).*?(?:Rp\.?\s*|IDR\s*)?(\d+(?:[.,]\d+)*(?:\s*(?:juta|miliar|ribu|M|B))?)/gi;
  const valueMatches = userMessage.matchAll(valuePattern);
  for (const m of valueMatches) {
    await addFact("business", `Nilai proyek: ${m[0].trim()}`);
  }

  // Deteksi keputusan
  if (msg.includes("putuskan") || msg.includes("setuju") || msg.includes("deal") || msg.includes("sepakat")) {
    await addFact("decisions", `[${new Date().toLocaleDateString("id-ID")}] ${userMessage.substring(0, 150)}`);
  }

  // Deteksi deadline
  const deadlinePattern = /(?:deadline|tenggat|batas waktu|due date).*?(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{1,2}\s+(?:januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)\s+\d{4})/gi;
  const deadlineMatches = userMessage.matchAll(deadlinePattern);
  for (const m of deadlineMatches) {
    await addFact("projects", `Deadline: ${m[0].trim()}`);
  }
}

// ─── Cari konteks relevan di memory ─────────────────────
async function searchMemory(query) {
  const mem = await loadMemory();
  const q = query.toLowerCase();
  const results = [];

  const searchIn = (items, category) => {
    for (const item of items) {
      const text = typeof item === "string" ? item : item.content || "";
      if (text.toLowerCase().includes(q)) {
        results.push({ category, text: text.substring(0, 200) });
      }
    }
  };

  for (const [cat, items] of Object.entries(mem.facts)) {
    searchIn(items, cat);
  }
  searchIn(mem.learnings, "learnings");

  return results.slice(0, 5); // max 5 hasil
}

// ─── Format ringkasan memory ─────────────────────────────
async function getMemorySummary() {
  const mem = await loadMemory();

  const countFacts = Object.values(mem.facts).reduce((sum, arr) => sum + arr.length, 0);
  const latestLearnings = mem.learnings.slice(-5).map(l => `  • ${l.content}`).join("\n");
  const latestDecisions = mem.facts.decisions.slice(-3).map(d => `  • ${d.content || d}`).join("\n");
  const activeProjects = mem.facts.projects.slice(-5).map(p => `  • ${p.content || p}`).join("\n");

  return {
    total_facts: countFacts,
    total_conversations: mem.conversations.length,
    total_learnings: mem.learnings.length,
    latest_learnings: latestLearnings || "  (kosong)",
    latest_decisions: latestDecisions || "  (kosong)",
    active_projects: activeProjects || "  (kosong)"
  };
}

module.exports = {
  loadMemory,
  saveMemory,
  addFact,
  forgetTopic,
  autoExtract,
  searchMemory,
  getMemorySummary
};
