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
    return allFacts.slice(0, 5).map(f => `[${f.cat}] ${f.content}`).join("\n");
  } catch {
    return "";
  }
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
