require("dotenv").config();

const fs = require("fs-extra");
const path = require("path");

const PERF_FILE = "/root/ai-system/memory/agent-performance.json";

const AGENT_NAMES = ["chat", "procurement", "trading", "construction", "strategy", "admin", "ahs", "rab", "draft", "price"];

const DEFAULT_PERF = () => ({
  total_calls: 0,
  positive_count: 0,
  negative_count: 0,
  common_complaints: [],
  knowledge_additions: [],
  last_improved: null,
  created_at: new Date().toISOString()
});

async function loadPerformance() {
  try {
    await fs.ensureFile(PERF_FILE);
    const data = await fs.readJson(PERF_FILE).catch(() => null);
    if (!data) {
      const init = {};
      for (const n of AGENT_NAMES) init[n] = DEFAULT_PERF();
      return init;
    }
    // Ensure semua agent ada
    for (const n of AGENT_NAMES) {
      if (!data[n]) data[n] = DEFAULT_PERF();
    }
    return data;
  } catch {
    const init = {};
    for (const n of AGENT_NAMES) init[n] = DEFAULT_PERF();
    return init;
  }
}

async function savePerformance(data) {
  const tmpPath = PERF_FILE + ".tmp";
  await fs.writeFile(tmpPath, JSON.stringify(data, null, 2), "utf8");
  JSON.parse(await fs.readFile(tmpPath, "utf8"));
  await fs.rename(tmpPath, PERF_FILE);
}

async function recordCall(agentName) {
  const perf = await loadPerformance();
  if (!perf[agentName]) perf[agentName] = DEFAULT_PERF();
  perf[agentName].total_calls++;
  await savePerformance(perf);
}

async function recordPositiveFeedback(agentName) {
  const perf = await loadPerformance();
  if (!perf[agentName]) perf[agentName] = DEFAULT_PERF();
  perf[agentName].positive_count++;
  await savePerformance(perf);
}

async function recordNegativeFeedback(agentName, complaint = "") {
  const perf = await loadPerformance();
  if (!perf[agentName]) perf[agentName] = DEFAULT_PERF();
  perf[agentName].negative_count++;
  if (complaint) {
    perf[agentName].common_complaints.push({
      complaint: complaint.substring(0, 200),
      timestamp: new Date().toISOString()
    });
    if (perf[agentName].common_complaints.length > 30) {
      perf[agentName].common_complaints = perf[agentName].common_complaints.slice(-30);
    }
  }
  await savePerformance(perf);
}

async function recordKnowledgeAddition(agentName, knowledge) {
  const perf = await loadPerformance();
  if (!perf[agentName]) perf[agentName] = DEFAULT_PERF();
  perf[agentName].knowledge_additions.push({
    content: knowledge.substring(0, 200),
    timestamp: new Date().toISOString()
  });
  if (perf[agentName].knowledge_additions.length > 20) {
    perf[agentName].knowledge_additions = perf[agentName].knowledge_additions.slice(-20);
  }
  await savePerformance(perf);
}

async function getAgentReport() {
  const perf = await loadPerformance();
  const report = [];
  for (const [name, data] of Object.entries(perf)) {
    const total = data.total_calls || 0;
    const pos = data.positive_count || 0;
    const neg = data.negative_count || 0;
    const score = total > 0 ? Math.round((pos / (pos + neg + 0.001)) * 100) : 0;
    report.push({
      name,
      total_calls: total,
      positive: pos,
      negative: neg,
      score,
      needs_improvement: neg > 2 && score < 70,
      last_improved: data.last_improved
    });
  }
  return report.sort((a, b) => b.total_calls - a.total_calls);
}

async function markImproved(agentName) {
  const perf = await loadPerformance();
  if (!perf[agentName]) perf[agentName] = DEFAULT_PERF();
  perf[agentName].last_improved = new Date().toISOString();
  perf[agentName].common_complaints = []; // reset complaints setelah improve
  await savePerformance(perf);
}

module.exports = {
  recordCall,
  recordPositiveFeedback,
  recordNegativeFeedback,
  recordKnowledgeAddition,
  getAgentReport,
  markImproved,
  loadPerformance
};
