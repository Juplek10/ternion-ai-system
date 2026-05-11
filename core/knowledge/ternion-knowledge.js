require("dotenv").config();

const fs = require("fs-extra");
const path = require("path");

const KNOWLEDGE_DIR = "/root/ai-system/memory/knowledge";

const KNOWLEDGE_FILES = {
  konstruksi: path.join(KNOWLEDGE_DIR, "konstruksi.json"),
  komoditas:  path.join(KNOWLEDGE_DIR, "komoditas.json"),
  procurement: path.join(KNOWLEDGE_DIR, "procurement.json"),
  bisnis:     path.join(KNOWLEDGE_DIR, "bisnis.json")
};

// Map kata kunci → domain knowledge
const DOMAIN_TRIGGERS = {
  konstruksi:  ["konstruksi", "bangunan", "gedung", "material", "semen", "besi", "keramik", "upah", "tukang", "rab", "ahs", "bangunan", "sipil"],
  komoditas:   ["komoditas", "mangan", "mutiara", "kopi", "garam", "ekspor", "trading", "harga", "timor leste", "dili"],
  procurement: ["tender", "pengadaan", "lpse", "sbu", "siujk", "kontrak", "penawaran", "aanwijzing", "hps", "lelang"],
  bisnis:      ["strategi", "bisnis", "ternion", "pasar", "market", "peluang", "visi", "tim", "vector", "scripta"]
};

async function loadKnowledge(domain) {
  const file = KNOWLEDGE_FILES[domain];
  if (!file) return null;
  try {
    return await fs.readJson(file).catch(() => null);
  } catch {
    return null;
  }
}

async function saveKnowledge(domain, data) {
  const file = KNOWLEDGE_FILES[domain];
  if (!file) return;
  data.last_updated = new Date().toISOString();
  const tmpPath = file + ".tmp";
  await fs.writeFile(tmpPath, JSON.stringify(data, null, 2), "utf8");
  JSON.parse(await fs.readFile(tmpPath, "utf8"));
  await fs.rename(tmpPath, file);

  // Backup ke Drive
  try {
    const { uploadFile } = require("../integrations/drive-backup");
    await uploadFile(file, "CORE-SYSTEM/knowledge");
  } catch {}
}

// Deteksi domain yang relevan dari query
function detectRelevantDomains(query) {
  const q = query.toLowerCase();
  const relevant = [];
  for (const [domain, triggers] of Object.entries(DOMAIN_TRIGGERS)) {
    if (triggers.some(t => q.includes(t))) relevant.push(domain);
  }
  return relevant.length > 0 ? relevant : [];
}

// Get knowledge entries yang relevan untuk injection ke Claude
async function getRelevantKnowledge(query) {
  const domains = detectRelevantDomains(query);
  if (domains.length === 0) return "";

  const lines = [];
  for (const domain of domains) {
    const kb = await loadKnowledge(domain);
    if (!kb || !kb.entries) continue;
    const relevant = kb.entries
      .filter(e => {
        const content = e.content.toLowerCase();
        const q = query.toLowerCase();
        // Prioritaskan yang sangat relevan
        return q.split(" ").some(word => word.length > 3 && content.includes(word));
      })
      .slice(0, 5);

    if (relevant.length > 0) {
      lines.push(`\n[KNOWLEDGE ${domain.toUpperCase()}]`);
      for (const e of relevant) lines.push(`• ${e.content}`);
    }
  }

  return lines.length > 0 ? `\n=== KNOWLEDGE BASE TERNION ===\n${lines.join("\n")}\n=== AKHIR KNOWLEDGE ===` : "";
}

// Update knowledge dari percakapan
async function updateKnowledgeFromConversation(message) {
  const msg = message.toLowerCase();

  // Deteksi update harga
  const hargaPattern = /harga\s+(\w+(?:\s+\w+)?)\s+(?:naik|turun|sekarang|jadi|menjadi)\s+(?:rp\.?\s*)?(\d+(?:[.,]\d+)*(?:\s*(?:juta|ribu|rb|k|m))?)/gi;
  for (const m of message.matchAll(hargaPattern)) {
    const item = m[1].trim();
    const harga = m[2].trim();
    const entry = { category: "harga_update", content: `Update harga ${item}: Rp ${harga} (${new Date().toLocaleDateString("id-ID")})`, added_at: new Date().toISOString() };

    // Masukkan ke domain yang relevan
    const domains = detectRelevantDomains(item);
    const targetDomain = domains[0] || "konstruksi";
    const kb = await loadKnowledge(targetDomain);
    if (kb) {
      kb.entries.push(entry);
      if (kb.entries.length > 100) kb.entries = kb.entries.slice(-100);
      await saveKnowledge(targetDomain, kb);
      console.log(`[KNOWLEDGE] Updated ${targetDomain}: ${entry.content}`);
    }
  }
}

// Update knowledge manual
async function updateKnowledge(domain, fakta) {
  const targetDomain = KNOWLEDGE_FILES[domain] ? domain : detectRelevantDomains(domain)[0] || "bisnis";
  const kb = await loadKnowledge(targetDomain) || { domain: targetDomain, entries: [] };
  kb.entries.push({
    category: "manual_update",
    content: fakta,
    added_at: new Date().toISOString(),
    source: "brian_manual"
  });
  if (kb.entries.length > 200) kb.entries = kb.entries.slice(-200);
  await saveKnowledge(targetDomain, kb);
}

// Get knowledge untuk /knowledge command
async function getKnowledge(topik) {
  if (topik === "all" || !topik) {
    const lines = ["📚 <b>TERNION KNOWLEDGE BASE</b>\n━━━━━━━━━━━━━━━━━━━━━"];
    for (const [domain, file] of Object.entries(KNOWLEDGE_FILES)) {
      const kb = await loadKnowledge(domain);
      if (kb) {
        lines.push(`\n<b>${domain.toUpperCase()}</b> (${(kb.entries || []).length} entri)`);
        const recent = (kb.entries || []).slice(-3);
        for (const e of recent) lines.push(`  • ${e.content.substring(0, 100)}`);
      }
    }
    return lines.join("\n");
  }

  // Cari domain yang cocok
  const targetDomain = KNOWLEDGE_FILES[topik.toLowerCase()] ? topik.toLowerCase() : detectRelevantDomains(topik)[0];
  if (!targetDomain) return `❌ Topik "${topik}" tidak ditemukan.\nTopik tersedia: konstruksi, komoditas, procurement, bisnis`;

  const kb = await loadKnowledge(targetDomain);
  if (!kb) return `❌ Knowledge base "${targetDomain}" belum ada.`;

  const lines = [`📚 <b>KNOWLEDGE: ${targetDomain.toUpperCase()}</b>\n━━━━━━━━━━━━━━━━━━━━━`];

  // Group by category
  const grouped = {};
  for (const e of (kb.entries || [])) {
    if (!grouped[e.category]) grouped[e.category] = [];
    grouped[e.category].push(e.content);
  }

  for (const [cat, items] of Object.entries(grouped)) {
    lines.push(`\n<b>${cat.replace(/_/g, " ").toUpperCase()}</b>`);
    for (const item of items.slice(-5)) {
      lines.push(`  • ${item.substring(0, 150)}`);
    }
  }

  lines.push(`\n<i>Last updated: ${kb.last_updated?.split("T")[0] || "N/A"}</i>`);
  return lines.join("\n");
}

module.exports = {
  getRelevantKnowledge,
  updateKnowledgeFromConversation,
  updateKnowledge,
  getKnowledge,
  loadKnowledge,
  detectRelevantDomains
};
