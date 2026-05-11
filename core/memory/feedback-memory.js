require("dotenv").config();

const fs = require("fs-extra");
const path = require("path");

const FEEDBACK_FILE = "/root/ai-system/memory/feedback.json";

const DEFAULT = {
  positive: [],
  negative: [],
  corrections: [],
  knowledge_additions: []
};

async function loadFeedback() {
  try {
    await fs.ensureFile(FEEDBACK_FILE);
    const data = await fs.readJson(FEEDBACK_FILE).catch(() => null);
    if (!data) return { ...DEFAULT };
    return {
      positive:            data.positive            || [],
      negative:            data.negative            || [],
      corrections:         data.corrections         || [],
      knowledge_additions: data.knowledge_additions || []
    };
  } catch {
    return { ...DEFAULT };
  }
}

async function saveFeedback(data) {
  const tmpPath = FEEDBACK_FILE + ".tmp";
  const json = JSON.stringify(data, null, 2);
  await fs.writeFile(tmpPath, json, "utf8");
  JSON.parse(await fs.readFile(tmpPath, "utf8")); // verify
  await fs.rename(tmpPath, FEEDBACK_FILE);

  // Backup ke Drive
  backupFeedback().catch(() => {});
}

async function backupFeedback() {
  try {
    const { uploadFile } = require("../integrations/drive-backup");
    await uploadFile(FEEDBACK_FILE, "CORE-SYSTEM/memory");
  } catch {}
}

async function addPositive(userMsg, aiReply, context = "") {
  const fb = await loadFeedback();
  fb.positive.push({
    timestamp: new Date().toISOString(),
    user_message: userMsg.substring(0, 300),
    ai_reply: aiReply.substring(0, 300),
    context
  });
  if (fb.positive.length > 200) fb.positive = fb.positive.slice(-200);
  await saveFeedback(fb);
}

async function addNegative(userMsg, aiReply, context = "") {
  const fb = await loadFeedback();
  fb.negative.push({
    timestamp: new Date().toISOString(),
    user_message: userMsg.substring(0, 300),
    ai_reply: aiReply.substring(0, 300),
    context,
    explanation: null // akan diisi oleh follow-up
  });
  if (fb.negative.length > 200) fb.negative = fb.negative.slice(-200);
  await saveFeedback(fb);
  return fb.negative.length - 1; // return index untuk follow-up
}

async function addNegativeExplanation(explanation) {
  const fb = await loadFeedback();
  // Update entry negative terakhir yang belum ada penjelasannya
  const lastNeg = [...fb.negative].reverse().find(n => !n.explanation);
  if (lastNeg) {
    lastNeg.explanation = explanation.substring(0, 500);
    // Juga simpan ke corrections
    fb.corrections.push({
      timestamp: new Date().toISOString(),
      issue: lastNeg.ai_reply.substring(0, 200),
      correction: explanation.substring(0, 500),
      original_query: lastNeg.user_message.substring(0, 200)
    });
    if (fb.corrections.length > 100) fb.corrections = fb.corrections.slice(-100);
  }
  await saveFeedback(fb);
}

async function addKnowledge(knowledge) {
  const fb = await loadFeedback();
  fb.knowledge_additions.push({
    timestamp: new Date().toISOString(),
    content: knowledge.substring(0, 500)
  });
  if (fb.knowledge_additions.length > 200) fb.knowledge_additions = fb.knowledge_additions.slice(-200);
  await saveFeedback(fb);

  // Juga simpan ke long-term memory
  try {
    const { addFact } = require("./long-term-memory");
    await addFact("brian", knowledge.substring(0, 200));
  } catch {}
}

async function getFeedbackSummary() {
  const fb = await loadFeedback();
  return {
    positive_count: fb.positive.length,
    negative_count: fb.negative.length,
    corrections_count: fb.corrections.length,
    knowledge_count: fb.knowledge_additions.length,
    recent_negative: fb.negative.slice(-3).map(n => ({
      query: n.user_message.substring(0, 100),
      explanation: n.explanation || "belum ada penjelasan"
    })),
    recent_knowledge: fb.knowledge_additions.slice(-3).map(k => k.content.substring(0, 100))
  };
}

module.exports = {
  loadFeedback,
  addPositive,
  addNegative,
  addNegativeExplanation,
  addKnowledge,
  getFeedbackSummary
};
