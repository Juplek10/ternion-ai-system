require("dotenv").config();

const { execFile } = require("child_process");
const { promisify } = require("util");
const fs = require("fs");
const path = require("path");

const execFileAsync = promisify(execFile);

const SOUL_PATH = "/root/ai-system/prompts/ternion-soul.txt";
const MEMORY_PATH = "/root/ai-system/memory/long-term.json";
const MEMORY_DIR = "/root/ai-system/memory";

function loadSoul() {
  try {
    return fs.readFileSync(SOUL_PATH, "utf8").trim();
  } catch {
    return "Kamu adalah Ternion-AI, asisten cerdas Brian Kinayom (dipanggil Bry), Founder & Nexus Lead TERNION GROUP, Kupang NTT. Bisnis: procurement, konstruksi, trading, ekspor-impor, kafe. Tim: VECTOR (ops), SCRIPTA (admin). Pasar: NTT, Timor Leste, Jakarta.";
  }
}

function loadRecentMemory() {
  const lines = [];

  // 1. Personal data Brian (data tetap)
  try {
    const personal = JSON.parse(fs.readFileSync(path.join(MEMORY_DIR, "personal.json"), "utf8"));
    for (const e of (personal.entries || []).slice(-5)) {
      lines.push(`[personal] ${e.content || e}`);
    }
  } catch {}

  // 2. Domain files — 3 entri terbaru per domain
  const DOMAINS = ["bisnis", "proyek", "kontak", "keputusan", "percakapan"];
  for (const domain of DOMAINS) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(MEMORY_DIR, `${domain}.json`), "utf8"));
      for (const e of (data.entries || []).slice(-3)) {
        if (domain === "percakapan") {
          if (e.user) lines.push(`[percakapan] User pernah berkata: ${e.user.substring(0, 120)}`);
        } else {
          lines.push(`[${domain}] ${(e.content || "").substring(0, 120)}`);
        }
      }
    } catch {}
  }

  // 3. Long-term facts sebagai fallback
  try {
    const mem = JSON.parse(fs.readFileSync(MEMORY_PATH, "utf8"));
    const allFacts = [];
    for (const [cat, items] of Object.entries(mem.facts || {})) {
      for (const item of items) {
        allFacts.push({ cat, content: item.content || item, added_at: item.added_at || "" });
      }
    }
    allFacts.sort((a, b) => (b.added_at > a.added_at ? 1 : -1));
    for (const f of allFacts.slice(0, 5)) {
      lines.push(`[${f.cat}] ${f.content}`);
    }
  } catch {}

  return [...new Set(lines)].slice(0, 20).join("\n");
}

/**
 * askClaude(prompt, options)
 * options.systemContext — string: konteks peran spesifik (untuk tools/agents)
 * options.timeout       — number: ms timeout (default 90000)
 */
async function askClaude(prompt, options = {}) {
  const soul = loadSoul();
  const recentMemory = loadRecentMemory();
  const systemContext = options.systemContext || "";
  const timeout = options.timeout || 90000;

  const memSection = recentMemory
    ? `\n\n=== KONTEKS MEMORY BRIAN ===\n${recentMemory}\n=== AKHIR MEMORY ===`
    : "";

  const roleSection = systemContext
    ? `\n\n=== PERAN KHUSUS ===\n${systemContext}\n=== AKHIR PERAN ===`
    : "";

  const fullPrompt = `${soul}${memSection}${roleSection}\n\n---\n\n${prompt}`;

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
