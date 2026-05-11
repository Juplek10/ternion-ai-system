require("dotenv").config();

const { execFile } = require("child_process");
const { promisify } = require("util");
const fs = require("fs");
const path = require("path");

const execFileAsync = promisify(execFile);

const SOUL_PATH = "/root/ai-system/prompts/ternion-soul.txt";
const MEMORY_PATH = "/root/ai-system/memory/long-term.json";
const MEMORY_DIR = "/root/ai-system/memory";
const DAILY_SUMMARY_DIR = path.join(MEMORY_DIR, "daily-summary");

function loadSoul() {
  try {
    return fs.readFileSync(SOUL_PATH, "utf8").trim();
  } catch {
    return "Kamu adalah Ternion-AI, asisten cerdas Brian Kinayom (dipanggil Bry), Founder & Nexus Lead TERNION GROUP, Kupang NTT. Bisnis: procurement, konstruksi, trading, ekspor-impor, kafe. Tim: VECTOR (ops), SCRIPTA (admin). Pasar: NTT, Timor Leste, Jakarta.";
  }
}

// ─── Load daily summary kemarin (untuk context continuity) ─
function loadDailySummary() {
  try {
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
    const today = new Date().toISOString().split("T")[0];

    for (const dateKey of [today, yesterday]) {
      const summaryPath = path.join(DAILY_SUMMARY_DIR, `${dateKey}.json`);
      if (fs.existsSync(summaryPath)) {
        const data = JSON.parse(fs.readFileSync(summaryPath, "utf8"));
        if (data && data.summary) {
          return `[Ringkasan ${dateKey}] ${data.summary.substring(0, 300)}`;
        }
      }
    }
  } catch {}
  return "";
}

// ─── Semantic memory search: cari berdasarkan kata kunci ──
function semanticMemorySearch(prompt) {
  const lines = [];
  // Ekstrak kata kunci meaningful dari prompt (>3 huruf, bukan stopword)
  const stopwords = new Set(["yang", "dengan", "untuk", "dalam", "pada", "atau", "tidak", "bisa", "dari", "akan", "sudah", "masih", "juga", "saya", "kamu", "brian"]);
  const keywords = prompt.toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 3 && !stopwords.has(w) && /^[a-z]/.test(w))
    .slice(0, 8);

  if (keywords.length === 0) return "";

  // Search di long-term.json
  try {
    const mem = JSON.parse(fs.readFileSync(MEMORY_PATH, "utf8"));
    const scored = [];
    for (const [cat, items] of Object.entries(mem.facts || {})) {
      for (const item of items) {
        const content = (item.content || item).toLowerCase();
        const score = keywords.filter(kw => content.includes(kw)).length;
        if (score > 0) {
          scored.push({ cat, content: item.content || item, score, added_at: item.added_at || "" });
        }
      }
    }
    // Sort: score tinggi dulu, lalu terbaru
    scored.sort((a, b) => b.score - a.score || (b.added_at > a.added_at ? 1 : -1));
    for (const item of scored.slice(0, 5)) {
      lines.push(`[${item.cat}] ${item.content.substring(0, 150)}`);
    }
  } catch {}

  // Search di domain files
  const DOMAINS = ["percakapan", "bisnis", "proyek", "keputusan"];
  for (const domain of DOMAINS) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(MEMORY_DIR, `${domain}.json`), "utf8"));
      const scored = [];
      for (const e of (data.entries || [])) {
        const content = (e.user || e.content || "").toLowerCase();
        const score = keywords.filter(kw => content.includes(kw)).length;
        if (score > 0) {
          scored.push({ content: e.user || e.content || "", score, ts: e.timestamp || "" });
        }
      }
      scored.sort((a, b) => b.score - a.score || (b.ts > a.ts ? 1 : -1));
      if (scored.length > 0) {
        lines.push(`[${domain}] ${scored[0].content.substring(0, 150)}`);
      }
    } catch {}
  }

  return lines.length > 0 ? `\n=== MEMORY RELEVAN ===\n${lines.join("\n")}\n=== AKHIR MEMORY RELEVAN ===` : "";
}

// ─── Load memory tetap (personal + kontak) ───────────────
function loadStaticMemory() {
  const lines = [];
  try {
    const personal = JSON.parse(fs.readFileSync(path.join(MEMORY_DIR, "personal.json"), "utf8"));
    for (const e of (personal.entries || []).slice(0, 9)) { // Data tetap Brian
      if (!e.content.includes("pernah berkata")) lines.push(`[personal] ${e.content || e}`);
    }
  } catch {}
  return lines.join("\n");
}

/**
 * askClaude(prompt, options)
 * options.systemContext — string: konteks peran spesifik
 * options.timeout       — number: ms timeout (default 90000)
 * options.skipKnowledge — bool: skip knowledge injection
 * options.skipMemory    — bool: skip semantic memory search
 */
async function askClaude(prompt, options = {}) {
  const soul = loadSoul();
  const systemContext = options.systemContext || "";
  const timeout = options.timeout || 90000;

  // 1. Static memory (data Brian — selalu ada)
  const staticMem = loadStaticMemory();

  // 2. Daily summary (context continuity)
  const dailySummary = loadDailySummary();

  // 3. Semantic memory search (berdasar kata kunci prompt)
  const semanticMem = options.skipMemory ? "" : semanticMemorySearch(prompt);

  // 4. Knowledge base yang relevan
  let knowledgeSection = "";
  if (!options.skipKnowledge) {
    try {
      const { getRelevantKnowledge } = require("../knowledge/ternion-knowledge");
      const kn = getRelevantKnowledge(prompt);
      knowledgeSection = (kn && typeof kn.then === "function") ? await kn : (kn || "");
    } catch {}
  }

  // Build context section
  const memParts = [];
  if (staticMem) memParts.push(staticMem);
  if (dailySummary) memParts.push(`[konteks_hari_ini] ${dailySummary}`);
  const memSection = memParts.length > 0
    ? `\n\n=== PROFIL & KONTEKS BRIAN ===\n${memParts.join("\n")}\n=== AKHIR PROFIL ===`
    : "";

  const roleSection = systemContext
    ? `\n\n=== PERAN KHUSUS ===\n${systemContext}\n=== AKHIR PERAN ===`
    : "";

  const fullPrompt = `${soul}${memSection}${semanticMem}${knowledgeSection}${roleSection}\n\n---\n\n${prompt}`;

  try {
    const { stdout } = await execFileAsync(
      "claude",
      ["-p", fullPrompt, "--output-format", "text"],
      { timeout, maxBuffer: 1024 * 1024 * 8 }
    );
    return stdout.trim();
  } catch (err) {
    console.error("[CLAUDE-PIPE] Error:", err.message?.substring(0, 200));
    return "Maaf Bry, coba kirim ulang pesan kamu.";
  }
}

module.exports = askClaude;
