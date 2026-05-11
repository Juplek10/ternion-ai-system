require("dotenv").config();

const axios = require("axios");

// ─── Tavily Search (jika ada API key) ───────────────────
async function searchTavily(query) {
  const key = process.env.TAVILY_API_KEY;
  if (!key) throw new Error("TAVILY_API_KEY tidak diset");

  const res = await axios.post(
    "https://api.tavily.com/search",
    { api_key: key, query, search_depth: "basic", max_results: 5, include_answer: true },
    { timeout: 15000 }
  );

  const data = res.data;
  const answer = data.answer || "";
  const results = (data.results || []).slice(0, 4).map(r =>
    `• ${r.title}\n  ${r.url}\n  ${(r.content || "").substring(0, 200)}`
  ).join("\n\n");

  return answer
    ? `${answer}\n\nSumber:\n${results}`
    : results;
}

// ─── DuckDuckGo Instant Answer (tanpa API key) ───────────
async function searchDDG(query) {
  const res = await axios.get("https://api.duckduckgo.com/", {
    params: { q: query, format: "json", no_html: 1, skip_disambig: 1 },
    timeout: 10000,
    headers: { "User-Agent": "TernionAI/1.0" }
  });

  const d = res.data;
  const parts = [];

  if (d.AbstractText) parts.push(d.AbstractText);
  if (d.Answer) parts.push(`Jawaban: ${d.Answer}`);
  if (d.Definition) parts.push(`Definisi: ${d.Definition}`);

  if (d.RelatedTopics && d.RelatedTopics.length > 0) {
    const topics = d.RelatedTopics.slice(0, 4)
      .filter(t => t.Text)
      .map(t => `• ${t.Text.substring(0, 150)}`);
    if (topics.length > 0) parts.push("\nTopik terkait:\n" + topics.join("\n"));
  }

  if (parts.length === 0) {
    return `Tidak ada hasil instan untuk "${query}". Coba kata kunci yang lebih spesifik.`;
  }

  return parts.join("\n\n");
}

// ─── Main: coba Tavily dulu, fallback ke DDG ────────────
async function searchWeb(query) {
  const tavilyKey = process.env.TAVILY_API_KEY;
  if (tavilyKey) {
    try {
      const result = await searchTavily(query);
      return `🔍 <b>Hasil Web (Tavily):</b>\n${result}`;
    } catch (err) {
      console.error("[SEARCH] Tavily error:", err.message, "— fallback ke DuckDuckGo");
    }
  }

  try {
    const result = await searchDDG(query);
    return `🔍 <b>Hasil Web:</b>\n${result}`;
  } catch (err) {
    return `Gagal melakukan pencarian web: ${err.message}`;
  }
}

module.exports = { searchWeb };
