require("dotenv").config();

const fs = require("fs-extra");
const path = require("path");
const { execFile } = require("child_process");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);

const EVOLUTION_LOG = "/root/ai-system/memory/evolution-log.json";
const AGENTS_DIR = "/root/ai-system/core/agents";
const SKILLS_DIR = "/root/ai-system/core/skills";

// Map agent name → file path
const AGENT_FILES = {
  procurement:  path.join(AGENTS_DIR, "procurement-agent.js"),
  trading:      path.join(AGENTS_DIR, "trading-agent.js"),
  construction: path.join(AGENTS_DIR, "construction-agent.js"),
  strategy:     path.join(AGENTS_DIR, "strategy-agent.js"),
  admin:        path.join(AGENTS_DIR, "admin-agent.js")
};

async function loadEvolutionLog() {
  try {
    await fs.ensureFile(EVOLUTION_LOG);
    return await fs.readJson(EVOLUTION_LOG).catch(() => []);
  } catch {
    return [];
  }
}

async function saveEvolutionLog(log) {
  if (log.length > 90) log = log.slice(-90);
  await fs.writeJson(EVOLUTION_LOG, log, { spaces: 2 });
}

// Extract SYSTEM_PROMPT dari file agent
async function extractSystemPrompt(filePath) {
  try {
    const content = await fs.readFile(filePath, "utf8");
    const match = content.match(/const SYSTEM_(?:PROMPT|CONTEXT)\s*=\s*`([\s\S]+?)`;/);
    return match ? match[1].trim() : "";
  } catch {
    return "";
  }
}

// Update SYSTEM_PROMPT di file agent
async function updateSystemPrompt(filePath, newPrompt) {
  try {
    let content = await fs.readFile(filePath, "utf8");
    // Replace konten antara backtick pertama dan terakhir dari SYSTEM_PROMPT/CONTEXT
    content = content.replace(
      /(const SYSTEM_(?:PROMPT|CONTEXT)\s*=\s*`)([\s\S]+?)(`)/,
      `$1${newPrompt}$3`
    );
    await fs.writeFile(filePath, content, "utf8");
    return true;
  } catch (err) {
    console.error("[OPTIMIZER] Update system prompt gagal:", err.message);
    return false;
  }
}

// Optimize satu agent berdasarkan feedback
async function optimizeAgent(agentName, performance, feedbackData) {
  const filePath = AGENT_FILES[agentName];
  if (!filePath || !(await fs.pathExists(filePath))) {
    console.log(`[OPTIMIZER] File tidak ditemukan untuk agent: ${agentName}`);
    return null;
  }

  const currentPrompt = await extractSystemPrompt(filePath);
  if (!currentPrompt) {
    console.log(`[OPTIMIZER] Tidak bisa extract system prompt: ${agentName}`);
    return null;
  }

  const complaints = (performance.common_complaints || [])
    .slice(-10)
    .map(c => `- ${c.complaint}`)
    .join("\n");

  const knowledgeAdds = (performance.knowledge_additions || [])
    .slice(-10)
    .map(k => `- ${k.content}`)
    .join("\n");

  const recentCorrections = (feedbackData.corrections || [])
    .slice(-5)
    .map(c => `- Issue: ${c.issue}\n  Correction: ${c.correction}`)
    .join("\n");

  if (!complaints && !knowledgeAdds && !recentCorrections) {
    console.log(`[OPTIMIZER] Tidak ada feedback untuk ${agentName}`);
    return null;
  }

  const optimizePrompt = `Kamu adalah prompt engineer senior untuk sistem AI bisnis.

AGENT: ${agentName}
KONTEKS: Agent untuk TERNION GROUP (Brian Kinayom, Kupang NTT)
Bisnis: procurement, konstruksi, trading, ekspor-impor

SYSTEM PROMPT SAAT INI:
${currentPrompt}

FEEDBACK NEGATIF YANG DITERIMA:
${complaints || "(tidak ada)"}

KOREKSI DARI USER:
${recentCorrections || "(tidak ada)"}

KNOWLEDGE TAMBAHAN DARI BRIAN:
${knowledgeAdds || "(tidak ada)"}

TUGAS:
Tulis improved system prompt yang:
1. Fix masalah spesifik dari feedback negatif
2. Incorporasi knowledge tambahan dari Brian
3. Tetap fokus pada konteks bisnis TERNION di NTT
4. Lebih spesifik dan actionable untuk Brian
5. Pertahankan keahlian inti yang sudah ada
6. Maksimal 400 kata

PENTING: Output hanya teks system prompt saja, tanpa penjelasan atau komentar.`;

  try {
    const { stdout } = await execFileAsync(
      "claude",
      ["-p", optimizePrompt, "--output-format", "text"],
      { timeout: 60000, maxBuffer: 1024 * 1024 * 4 }
    );
    const newPrompt = stdout.trim();
    if (newPrompt.length < 50) return null;

    const updated = await updateSystemPrompt(filePath, newPrompt);
    return updated ? newPrompt : null;
  } catch (err) {
    console.error(`[OPTIMIZER] Claude gagal untuk ${agentName}:`, err.message);
    return null;
  }
}

// Main: jalankan optimization untuk semua agent yang perlu
async function runPromptOptimizer() {
  const { getAgentReport, markImproved } = require("./agent-evolution");
  const { loadFeedback } = require("../memory/feedback-memory");

  const report = await getAgentReport();
  const feedback = await loadFeedback();
  const perf = require("./agent-evolution");
  const perfData = await perf.loadPerformance();

  const updated = [];
  const skipped = [];

  for (const agent of report) {
    if (!AGENT_FILES[agent.name]) { skipped.push(agent.name); continue; }

    // Optimize jika ada feedback negatif atau knowledge tambahan
    const agentPerf = perfData[agent.name] || {};
    const hasComplaints = (agentPerf.common_complaints || []).length > 0;
    const hasKnowledge = (agentPerf.knowledge_additions || []).length > 0;

    if (!hasComplaints && !hasKnowledge) { skipped.push(agent.name); continue; }

    console.log(`[OPTIMIZER] Optimizing ${agent.name}...`);
    const newPrompt = await optimizeAgent(agent.name, agentPerf, feedback);
    if (newPrompt) {
      await markImproved(agent.name);
      updated.push({
        agent: agent.name,
        score_before: agent.score,
        improved_at: new Date().toISOString()
      });
      console.log(`[OPTIMIZER] ✅ ${agent.name} updated`);
    }
  }

  // Log evolusi
  const log = await loadEvolutionLog();
  const entry = {
    date: new Date().toISOString().split("T")[0],
    timestamp: new Date().toISOString(),
    agents_updated: updated.map(u => u.agent),
    agents_skipped: skipped,
    total_positive: report.reduce((s, a) => s + a.positive, 0),
    total_negative: report.reduce((s, a) => s + a.negative, 0)
  };
  log.push(entry);
  await saveEvolutionLog(log);

  // Generate report untuk Telegram
  const bestAgent = report.filter(a => a.total_calls > 0).sort((a, b) => b.score - a.score)[0];
  const worstAgent = report.filter(a => a.negative > 2).sort((a, b) => a.score - b.score)[0];

  const dateStr = new Date().toLocaleDateString("id-ID", {
    day: "numeric", month: "long", year: "numeric",
    timeZone: "Asia/Makassar"
  });

  const telegramReport =
`🧬 <b>EVOLUTION REPORT ${dateStr}</b>
━━━━━━━━━━━━━━━━━━━━━
🔄 Agent diupdate: ${updated.length > 0 ? updated.map(u => u.agent).join(", ") : "tidak ada"}
📈 Improvement areas: ${updated.length > 0 ? "feedback negatif & knowledge baru" : "-"}
💡 Knowledge baru: ${(feedback.knowledge_additions || []).length} entri total
⭐ Best performing: ${bestAgent ? `${bestAgent.name} (score: ${bestAgent.score}%)` : "N/A"}
⚠️ Needs attention: ${worstAgent ? `${worstAgent.name} (score: ${worstAgent.score}%)` : "semua oke"}`;

  return { updated, skipped, telegramReport };
}

module.exports = { runPromptOptimizer, optimizeAgent, extractSystemPrompt };
