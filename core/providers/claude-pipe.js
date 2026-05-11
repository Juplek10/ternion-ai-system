require("dotenv").config();

const { execFile } = require("child_process");
const { promisify } = require("util");
const fs = require("fs");
const path = require("path");

const execFileAsync = promisify(execFile);

const SOUL_PATH = "/root/ai-system/prompts/ternion-soul.txt";
const MEMORY_PATH = "/root/ai-system/memory/long-term.json";

function loadSoul() {
  try {
    return fs.readFileSync(SOUL_PATH, "utf8").trim();
  } catch {
    return "Kamu adalah Ternion-AI, asisten cerdas Brian Kinayom dari TERNION GROUP, Kupang NTT.";
  }
}

function loadRecentMemory() {
  const lines = [];

  // 1. Baca dari personal.json (data tetap Brian)
  try {
    const PERSONAL_PATH = path.join(path.dirname(MEMORY_PATH), "personal.json");
    const personal = JSON.parse(fs.readFileSync(PERSONAL_PATH, "utf8"));
    const entries = (personal.entries || []).slice(-5);
    for (const e of entries) {
      lines.push(`[personal] ${e.content || e}`);
    }
  } catch {}

  // 2. Baca dari domain files — 3 entri terakhir per domain
  const DOMAIN_FILES = ["bisnis", "proyek", "kontak", "keputusan", "percakapan"];
  const memDir = path.dirname(MEMORY_PATH);
  for (const domain of DOMAIN_FILES) {
    try {
      const domainPath = path.join(memDir, `${domain}.json`);
      const data = JSON.parse(fs.readFileSync(domainPath, "utf8"));
      const entries = (data.entries || []).slice(-3);
      for (const e of entries) {
        if (domain === "percakapan") {
          if (e.user) lines.push(`[percakapan] User: ${e.user.substring(0, 150)}`);
        } else {
          lines.push(`[${domain}] ${(e.content || "").substring(0, 150)}`);
        }
      }
    } catch {}
  }

  // 3. Baca dari long-term.json sebagai fallback
  try {
    const raw = fs.readFileSync(MEMORY_PATH, "utf8");
    const mem = JSON.parse(raw);
    const allFacts = [];
    for (const [cat, items] of Object.entries(mem.facts || {})) {
      for (const item of items) {
        allFacts.push({ cat, content: item.content || item, added_at: item.added_at || "" });
      }
    }
    allFacts.sort((a, b) => (b.added_at > a.added_at ? 1 : -1));
    const topFacts = allFacts.slice(0, 5).map(f => `[${f.cat}] ${f.content}`);
    lines.push(...topFacts);
  } catch {}

  return [...new Set(lines)].slice(0, 20).join("\n");
}

async function askClaude(prompt) {
  const soul = loadSoul();
  const recentMemory = loadRecentMemory();

  const memContext = recentMemory
    ? `\n\nKONTEKS MEMORY TERBARU:\n${recentMemory}`
    : "";

  const fullPrompt = `${soul}${memContext}\n\n---\n\n${prompt}`;

  try {
    const { stdout } = await execFileAsync(
      "claude",
      ["-p", fullPrompt, "--output-format", "text"],
      { timeout: 60000, maxBuffer: 1024 * 1024 * 5 }
    );
    return stdout.trim();
  } catch (err) {
    console.error("[CLAUDE-PIPE] Error:", err.message);
    throw err;
  }
}

module.exports = askClaude;
