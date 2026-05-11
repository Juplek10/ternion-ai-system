require("dotenv").config();

const fs = require("fs-extra");
const path = require("path");

const MEMORY_DIR = "/root/ai-system/memory";
const MEMORY_FILE = path.join(MEMORY_DIR, "long-term.json");

// ─── Domain files ────────────────────────────────────────
const DOMAIN_FILES = {
  personal:    path.join(MEMORY_DIR, "personal.json"),
  bisnis:      path.join(MEMORY_DIR, "bisnis.json"),
  proyek:      path.join(MEMORY_DIR, "proyek.json"),
  kontak:      path.join(MEMORY_DIR, "kontak.json"),
  keputusan:   path.join(MEMORY_DIR, "keputusan.json"),
  percakapan:  path.join(MEMORY_DIR, "percakapan.json")
};

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

// ─── Auto-detect domain dari konten ─────────────────────
function detectDomain(content) {
  const c = content.toLowerCase();
  if (c.includes("proyek") || c.includes("project") || c.includes("deadline") || c.includes("tender"))
    return "proyek";
  if (c.includes("pt ") || c.includes("cv ") || c.includes("kontak") || c.includes("telp") || c.includes("vendor") || c.includes("supplier") || c.includes("kontraktor"))
    return "kontak";
  if (c.includes("keputusan") || c.includes("putuskan") || c.includes("strategi") || c.includes("deal") || c.includes("sepakat") || c.includes("setuju"))
    return "keputusan";
  if (c.includes("bisnis") || c.includes("anggaran") || c.includes("budget") || c.includes("omzet") || c.includes("revenue") || c.includes("nilai") || c.includes("kontrak"))
    return "bisnis";
  if (c.includes("brian") || c.includes("saya") || c.includes("aku") || c.includes("keluarga") || c.includes("pribadi"))
    return "personal";
  return "percakapan";
}

// ─── Load domain memory ─────────────────────────────────
async function loadDomainMemory(domain) {
  const file = DOMAIN_FILES[domain];
  if (!file) return { domain, entries: [], last_updated: new Date().toISOString() };
  try {
    await fs.ensureFile(file);
    const data = await fs.readJson(file).catch(() => null);
    if (!data || !Array.isArray(data.entries)) {
      return { domain, entries: [], last_updated: new Date().toISOString() };
    }
    return data;
  } catch {
    return { domain, entries: [], last_updated: new Date().toISOString() };
  }
}

// ─── Simpan domain memory + async backup ke Drive ───────
async function saveDomainMemory(domain, data) {
  const file = DOMAIN_FILES[domain];
  if (!file) return;
  data.last_updated = new Date().toISOString();
  await fs.ensureFile(file);
  await fs.writeJson(file, data, { spaces: 2 });

  // Async backup ke Drive — tidak tunggu hasilnya
  backupDomainToDrive(domain, file).catch(() => {});
}

// ─── Backup domain file ke Google Drive ─────────────────
async function backupDomainToDrive(domain, filePath) {
  try {
    const { uploadFile, findOrCreateFolder } = require("../integrations/drive-backup");
    await uploadFile(filePath, "CORE-SYSTEM/memory");
    console.log(`[MEMORY] Backup Drive: ${domain}.json @ ${new Date().toISOString()}`);
  } catch (err) {
    // Drive mungkin offline — log saja, jangan crash
    console.error(`[MEMORY] Backup Drive gagal (${domain}):`, err.message);
  }
}

// ─── Load memory utama ───────────────────────────────────
async function loadMemory() {
  try {
    await fs.ensureFile(MEMORY_FILE);
    const data = await fs.readJson(MEMORY_FILE).catch(() => null);
    if (!data || typeof data !== "object") return { ...DEFAULT_MEMORY };
    return {
      facts: {
        brian:     data.facts?.brian     || [],
        business:  data.facts?.business  || [],
        decisions: data.facts?.decisions || [],
        contacts:  data.facts?.contacts  || [],
        projects:  data.facts?.projects  || []
      },
      conversations: data.conversations || [],
      learnings:     data.learnings     || []
    };
  } catch {
    return { ...DEFAULT_MEMORY };
  }
}

// ─── Simpan memory utama ─────────────────────────────────
async function saveMemory(mem) {
  await fs.ensureFile(MEMORY_FILE);
  await fs.writeJson(MEMORY_FILE, mem, { spaces: 2 });
}

// ─── Tambah fakta (+ domain + Drive backup) ─────────────
async function addFact(category, content) {
  const mem = await loadMemory();
  if (!mem.facts[category]) mem.facts[category] = [];

  const entry = { content, added_at: new Date().toISOString() };

  const isDuplicate = mem.facts[category].some(
    f => (f.content || f).toLowerCase() === content.toLowerCase()
  );
  if (!isDuplicate) {
    mem.facts[category].push(entry);
    if (mem.facts[category].length > 100) {
      mem.facts[category] = mem.facts[category].slice(-100);
    }
    await saveMemory(mem);

    // Simpan juga ke domain file
    const domain = detectDomain(content);
    const domainData = await loadDomainMemory(domain);
    domainData.entries.push({ content, category, added_at: entry.added_at });
    if (domainData.entries.length > 200) domainData.entries = domainData.entries.slice(-200);
    await saveDomainMemory(domain, domainData);
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
      f => !(f.content || f).toLowerCase().includes(lowerTopic)
    );
    deleted += before - mem.facts[cat].length;
  }

  mem.learnings = mem.learnings.filter(
    l => !(l.content || l).toLowerCase().includes(lowerTopic)
  );

  await saveMemory(mem);
  return deleted;
}

// ─── Auto-detect dan simpan fakta dari percakapan ───────
async function autoExtract(userMessage) {
  const msg = userMessage.toLowerCase();

  const companyPattern = /(?:PT|CV|UD|firma|perusahaan|vendor|supplier|kontraktor)\s+([A-Z][^\s,]+(?:\s[A-Z][^\s,]+)*)/gi;
  for (const m of userMessage.matchAll(companyPattern)) {
    await addFact("contacts", `Perusahaan: ${m[0].trim()}`);
  }

  const valuePattern = /(?:nilai|anggaran|budget|kontrak|harga).*?(?:Rp\.?\s*|IDR\s*)?(\d+(?:[.,]\d+)*(?:\s*(?:juta|miliar|ribu|M|B))?)/gi;
  for (const m of userMessage.matchAll(valuePattern)) {
    await addFact("business", `Nilai proyek: ${m[0].trim()}`);
  }

  if (msg.includes("putuskan") || msg.includes("setuju") || msg.includes("deal") || msg.includes("sepakat")) {
    await addFact("decisions", `[${new Date().toLocaleDateString("id-ID")}] ${userMessage.substring(0, 150)}`);
  }

  const deadlinePattern = /(?:deadline|tenggat|batas waktu|due date).*?(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{1,2}\s+(?:januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)\s+\d{4})/gi;
  for (const m of userMessage.matchAll(deadlinePattern)) {
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

  return results.slice(0, 5);
}

// ─── Ringkasan per domain untuk /memory ─────────────────
async function getMemorySummary() {
  const mem = await loadMemory();

  // Load semua domain counts
  const domains = {};
  let lastBackup = "belum pernah";
  for (const [domain, file] of Object.entries(DOMAIN_FILES)) {
    try {
      const data = await fs.readJson(file).catch(() => ({ entries: [] }));
      domains[domain] = {
        count: (data.entries || []).length,
        last_updated: data.last_updated || "-"
      };
      if (data.last_updated && (lastBackup === "belum pernah" || data.last_updated > lastBackup)) {
        lastBackup = data.last_updated;
      }
    } catch {
      domains[domain] = { count: 0, last_updated: "-" };
    }
  }

  const countFacts = Object.values(mem.facts).reduce((sum, arr) => sum + arr.length, 0);
  const latestLearnings = mem.learnings.slice(-5).map(l => `  • ${l.content || l}`).join("\n");
  const latestDecisions = mem.facts.decisions.slice(-3).map(d => `  • ${d.content || d}`).join("\n");
  const activeProjects  = mem.facts.projects.slice(-5).map(p => `  • ${p.content || p}`).join("\n");

  // Format waktu backup
  let backupStr = "belum pernah";
  if (lastBackup !== "belum pernah") {
    try {
      backupStr = new Date(lastBackup).toLocaleString("id-ID", { timeZone: "Asia/Makassar" });
    } catch { backupStr = lastBackup; }
  }

  return {
    total_facts: countFacts,
    total_conversations: mem.conversations.length,
    total_learnings: mem.learnings.length,
    latest_learnings: latestLearnings || "  (kosong)",
    latest_decisions: latestDecisions || "  (kosong)",
    active_projects:  activeProjects  || "  (kosong)",
    domains,
    last_backup: backupStr
  };
}

module.exports = {
  loadMemory,
  saveMemory,
  addFact,
  forgetTopic,
  autoExtract,
  searchMemory,
  getMemorySummary,
  detectDomain,
  loadDomainMemory,
  saveDomainMemory
};
