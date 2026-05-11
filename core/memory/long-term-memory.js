require("dotenv").config();

const fs = require("fs-extra");
const path = require("path");

const MEMORY_DIR = "/root/ai-system/memory";
const MEMORY_FILE = path.join(MEMORY_DIR, "long-term.json");
const VERSIONS_DIR = path.join(MEMORY_DIR, "versions");
const ARCHIVE_DIR = path.join(MEMORY_DIR, "archive");

const DOMAIN_FILES = {
  personal:   path.join(MEMORY_DIR, "personal.json"),
  bisnis:     path.join(MEMORY_DIR, "bisnis.json"),
  proyek:     path.join(MEMORY_DIR, "proyek.json"),
  kontak:     path.join(MEMORY_DIR, "kontak.json"),
  keputusan:  path.join(MEMORY_DIR, "keputusan.json"),
  percakapan: path.join(MEMORY_DIR, "percakapan.json")
};

const DEFAULT_MEMORY = {
  facts: { brian: [], business: [], decisions: [], contacts: [], projects: [] },
  conversations: [],
  learnings: []
};

// ─── Atomic write: tmp → verify → rename ────────────────
async function atomicWrite(filePath, data) {
  const tmpPath = filePath + ".tmp";
  try {
    await fs.ensureFile(tmpPath);
    const json = JSON.stringify(data, null, 2);
    await fs.writeFile(tmpPath, json, "utf8");

    // Verify JSON valid
    JSON.parse(await fs.readFile(tmpPath, "utf8"));

    // Atomic rename
    await fs.rename(tmpPath, filePath);
    return true;
  } catch (err) {
    console.error(`[MEMORY] Atomic write gagal (${path.basename(filePath)}):`, err.message);
    try { await fs.remove(tmpPath); } catch {}
    return false;
  }
}

// ─── Versi backup per domain ────────────────────────────
async function createVersionBackup(domain) {
  const file = DOMAIN_FILES[domain];
  if (!file || !(await fs.pathExists(file))) return;

  try {
    await fs.ensureDir(VERSIONS_DIR);
    const now = new Date();
    const ts = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}_${String(now.getHours()).padStart(2,"0")}${String(now.getMinutes()).padStart(2,"0")}`;
    const backupPath = path.join(VERSIONS_DIR, `${domain}_${ts}.json`);
    await fs.copy(file, backupPath);

    // Jaga hanya 7 versi terbaru per domain
    const all = await fs.readdir(VERSIONS_DIR);
    const domainVersions = all
      .filter(f => f.startsWith(`${domain}_`) && f.endsWith(".json"))
      .sort();
    if (domainVersions.length > 7) {
      const toDelete = domainVersions.slice(0, domainVersions.length - 7);
      for (const f of toDelete) {
        await fs.remove(path.join(VERSIONS_DIR, f)).catch(() => {});
      }
    }
  } catch (err) {
    console.error(`[MEMORY] Version backup gagal (${domain}):`, err.message);
  }
}

// ─── Restore dari versi terakhir yang valid ──────────────
async function restoreFromVersion(domain) {
  try {
    await fs.ensureDir(VERSIONS_DIR);
    const all = await fs.readdir(VERSIONS_DIR);
    const domainVersions = all
      .filter(f => f.startsWith(`${domain}_`) && f.endsWith(".json"))
      .sort()
      .reverse();

    for (const vf of domainVersions) {
      const vPath = path.join(VERSIONS_DIR, vf);
      try {
        const data = await fs.readJson(vPath);
        if (data && Array.isArray(data.entries)) {
          await fs.copy(vPath, DOMAIN_FILES[domain]);
          console.log(`[MEMORY] Restored ${domain} from ${vf}`);
          return { restored: true, from: vf };
        }
      } catch {}
    }
  } catch {}
  return { restored: false };
}

// ─── Integrity check semua domain files ─────────────────
async function integrityCheck() {
  const results = {};
  for (const [domain, file] of Object.entries(DOMAIN_FILES)) {
    try {
      if (!(await fs.pathExists(file))) {
        results[domain] = "missing";
        continue;
      }
      const raw = await fs.readFile(file, "utf8");
      const data = JSON.parse(raw);
      if (!data || !Array.isArray(data.entries)) {
        results[domain] = "corrupt";
        const r = await restoreFromVersion(domain);
        results[domain] = r.restored ? `restored_from_${r.from}` : "corrupt_no_backup";
      } else {
        results[domain] = "ok";
      }
    } catch (err) {
      results[domain] = "corrupt";
      const r = await restoreFromVersion(domain);
      results[domain] = r.restored ? `restored_from_${r.from}` : "corrupt_no_backup";
    }
  }
  return results;
}

// ─── Compression: archive percakapan lama ───────────────
async function compressIfNeeded(domain) {
  if (domain !== "percakapan") return;
  const file = DOMAIN_FILES[domain];
  try {
    const data = await fs.readJson(file).catch(() => ({ entries: [] }));
    if ((data.entries || []).length <= 500) return;

    await fs.ensureDir(ARCHIVE_DIR);
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
    const archivePath = path.join(ARCHIVE_DIR, `percakapan_${monthKey}.json`);

    // Load existing archive untuk bulan ini
    let archiveData = { domain: "percakapan_archive", month: monthKey, entries: [] };
    if (await fs.pathExists(archivePath)) {
      archiveData = await fs.readJson(archivePath).catch(() => archiveData);
    }

    // Pindahkan entri lama ke archive
    const toArchive = data.entries.slice(0, data.entries.length - 100);
    archiveData.entries.push(...toArchive);
    await atomicWrite(archivePath, archiveData);

    // Simpan hanya 100 terbaru
    data.entries = data.entries.slice(-100);
    await atomicWrite(file, data);
    console.log(`[MEMORY] Compressed percakapan: archived ${toArchive.length} entries`);
  } catch (err) {
    console.error("[MEMORY] Compress error:", err.message);
  }
}

// ─── Auto-detect domain dari konten ─────────────────────
function detectDomain(content) {
  const c = content.toLowerCase();
  if (c.includes("proyek") || c.includes("project") || c.includes("deadline") || c.includes("tender"))
    return "proyek";
  if (c.includes("pt ") || c.includes("cv ") || c.includes("kontak") || c.includes("telp") || c.includes("vendor") || c.includes("supplier"))
    return "kontak";
  if (c.includes("keputusan") || c.includes("putuskan") || c.includes("deal") || c.includes("sepakat") || c.includes("setuju"))
    return "keputusan";
  if (c.includes("bisnis") || c.includes("anggaran") || c.includes("budget") || c.includes("omzet") || c.includes("kontrak"))
    return "bisnis";
  if (c.includes("brian") || c.includes("saya") || c.includes("aku") || c.includes("pribadi"))
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

// ─── Simpan domain memory (atomic + versioning + Drive) ─
async function saveDomainMemory(domain, data) {
  const file = DOMAIN_FILES[domain];
  if (!file) return;
  data.last_updated = new Date().toISOString();

  await createVersionBackup(domain);
  const ok = await atomicWrite(file, data);
  if (!ok) {
    console.error(`[MEMORY] saveDomainMemory gagal atomic write: ${domain}`);
    return;
  }

  await compressIfNeeded(domain);
  backupDomainToDrive(domain, file).catch(() => {});
}

// ─── Backup domain file ke Google Drive ─────────────────
async function backupDomainToDrive(domain, filePath) {
  try {
    const { uploadFile } = require("../integrations/drive-backup");
    await uploadFile(filePath, "CORE-SYSTEM/memory");
    console.log(`[MEMORY] Drive backup: ${domain}.json`);
  } catch (err) {
    console.error(`[MEMORY] Drive backup gagal (${domain}):`, err.message);
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

// ─── Simpan memory utama (atomic) ───────────────────────
async function saveMemory(mem) {
  await atomicWrite(MEMORY_FILE, mem);
}

// ─── Tambah fakta ────────────────────────────────────────
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

    const domain = detectDomain(content);
    const domainData = await loadDomainMemory(domain);
    domainData.entries.push({ content, category, added_at: entry.added_at });
    if (domainData.entries.length > 200) domainData.entries = domainData.entries.slice(-200);
    await saveDomainMemory(domain, domainData);
  }
  return mem;
}

// ─── Hapus fakta ─────────────────────────────────────────
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

// ─── Auto-extract dari pesan ─────────────────────────────
async function autoExtract(userMessage) {
  const msg = userMessage.toLowerCase();

  const namePattern = /(?:nama\s+saya|saya\s+bernama|panggil\s+saya|my\s+name\s+is)\s+([A-Za-z][a-z]+(?:\s+[A-Z][a-z]+)*)/gi;
  for (const m of userMessage.matchAll(namePattern)) {
    const name = m[1]?.trim();
    if (name && name.length > 1) await addFact("contacts", `Nama orang: ${name}`);
  }

  const companyPattern = /(?:PT|CV|UD|firma|perusahaan|vendor|supplier|kontraktor)\s+([A-Z][^\s,]+(?:\s[A-Z][^\s,]+)*)/gi;
  for (const m of userMessage.matchAll(companyPattern)) {
    await addFact("contacts", `Perusahaan: ${m[0].trim()}`);
  }

  const valuePattern = /(?:nilai|anggaran|budget|kontrak|harga).*?(?:Rp\.?\s*|IDR\s*)?(\d+(?:[.,]\d+)*(?:\s*(?:juta|miliar|ribu|M|B))?)/gi;
  for (const m of userMessage.matchAll(valuePattern)) {
    await addFact("business", `Nilai: ${m[0].trim()}`);
  }

  if (msg.includes("putuskan") || msg.includes("setuju") || msg.includes("deal") || msg.includes("sepakat")) {
    await addFact("decisions", `[${new Date().toLocaleDateString("id-ID")}] ${userMessage.substring(0, 150)}`);
  }

  const deadlinePattern = /(?:deadline|tenggat|batas waktu).*?(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/gi;
  for (const m of userMessage.matchAll(deadlinePattern)) {
    await addFact("projects", `Deadline: ${m[0].trim()}`);
  }

  const bisnisKw = ["bisnis", "usaha", "omzet", "revenue", "pengadaan", "ekspor", "impor", "trading", "kafe", "konstruksi"];
  if (bisnisKw.some(kw => msg.includes(kw))) {
    await addFact("business", `[${new Date().toISOString().split("T")[0]}] ${userMessage.substring(0, 200)}`);
  }
}

// ─── Simpan percakapan lengkap ke semua domain ───────────
async function saveConversation(userMsg, aiReply, agentType = "chat") {
  const ts = new Date().toISOString();

  // 1. Simpan ke percakapan.json
  const convDomain = await loadDomainMemory("percakapan");
  convDomain.entries.push({
    timestamp: ts,
    agent: agentType,
    user: userMsg.substring(0, 500),
    assistant: aiReply.substring(0, 500)
  });
  await saveDomainMemory("percakapan", convDomain);

  // 2. Ekstrak nama orang → kontak.json
  const namePattern = /(?:nama\s+saya|saya\s+bernama|panggil\s+saya)\s+([A-Za-z][a-z]+(?:\s+[A-Z][a-z]+)*)/gi;
  for (const m of userMsg.matchAll(namePattern)) {
    const name = m[1]?.trim();
    if (name && name.length > 1 && !/^(kupang|ntt|jakarta|indonesia)$/i.test(name)) {
      const kontakDomain = await loadDomainMemory("kontak");
      const isDup = kontakDomain.entries.some(e => e.content?.toLowerCase().includes(name.toLowerCase()));
      if (!isDup) {
        kontakDomain.entries.push({ content: `Nama: ${name}`, timestamp: ts });
        await saveDomainMemory("kontak", kontakDomain);
        await addFact("contacts", `Nama orang: ${name}`);
      }
    }
  }

  // 3. Bisnis info → bisnis.json
  const bisnisKw = ["bisnis", "usaha", "omzet", "revenue", "pengadaan", "ekspor", "impor", "trading", "kafe", "konstruksi", "anggaran", "budget", "kontrak"];
  if (bisnisKw.some(kw => userMsg.toLowerCase().includes(kw))) {
    const bisnisDomain = await loadDomainMemory("bisnis");
    bisnisDomain.entries.push({ content: userMsg.substring(0, 300), agent: agentType, timestamp: ts });
    if (bisnisDomain.entries.length > 100) bisnisDomain.entries = bisnisDomain.entries.slice(-100);
    await saveDomainMemory("bisnis", bisnisDomain);
  }

  // 4. Proyek info → proyek.json
  const proyekKw = ["proyek", "tender", "deadline", "pembangunan", "pengadaan"];
  if (proyekKw.some(kw => userMsg.toLowerCase().includes(kw))) {
    const proyekDomain = await loadDomainMemory("proyek");
    proyekDomain.entries.push({ content: userMsg.substring(0, 300), timestamp: ts });
    if (proyekDomain.entries.length > 100) proyekDomain.entries = proyekDomain.entries.slice(-100);
    await saveDomainMemory("proyek", proyekDomain);
  }

  // 5. Keputusan → keputusan.json
  const keputusanKw = ["putuskan", "setuju", "deal", "sepakat", "keputusan", "konfirmasi", "approve"];
  if (keputusanKw.some(kw => userMsg.toLowerCase().includes(kw))) {
    const kepDomain = await loadDomainMemory("keputusan");
    kepDomain.entries.push({ content: `[${ts.split("T")[0]}] ${userMsg.substring(0, 300)}`, timestamp: ts });
    if (kepDomain.entries.length > 50) kepDomain.entries = kepDomain.entries.slice(-50);
    await saveDomainMemory("keputusan", kepDomain);
    await addFact("decisions", `[${ts.split("T")[0]}] ${userMsg.substring(0, 150)}`);
  }

  // 6. Simpan ke long-term conversations
  const mem = await loadMemory();
  mem.conversations.push({ timestamp: ts, agent: agentType, user: userMsg.substring(0, 300), assistant: aiReply.substring(0, 300) });
  if (mem.conversations.length > 50) mem.conversations = mem.conversations.slice(-50);
  await saveMemory(mem);
}

// ─── Semantic memory search ─────────────────────────────
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

  for (const [cat, items] of Object.entries(mem.facts)) searchIn(items, cat);
  searchIn(mem.learnings, "learnings");

  // Juga search domain files
  for (const [domain, file] of Object.entries(DOMAIN_FILES)) {
    try {
      const data = await fs.readJson(file).catch(() => ({ entries: [] }));
      for (const e of (data.entries || [])) {
        const text = e.user || e.content || "";
        if (text.toLowerCase().includes(q)) {
          results.push({ category: domain, text: text.substring(0, 200) });
        }
      }
    } catch {}
  }

  return [...new Map(results.map(r => [r.text, r])).values()].slice(0, 8);
}

// ─── Memory summary untuk /memory command ───────────────
async function getMemorySummary() {
  const mem = await loadMemory();
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

  let backupStr = "belum pernah";
  if (lastBackup !== "belum pernah") {
    try { backupStr = new Date(lastBackup).toLocaleString("id-ID", { timeZone: "Asia/Makassar" }); }
    catch { backupStr = lastBackup; }
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
  saveConversation,
  searchMemory,
  getMemorySummary,
  detectDomain,
  loadDomainMemory,
  saveDomainMemory,
  integrityCheck,
  atomicWrite,
  createVersionBackup,
  restoreFromVersion,
  compressIfNeeded
};
