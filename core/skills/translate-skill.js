const askClaude = require("../providers/claude-pipe");

const SUPPORTED_LANGUAGES = {
  "indonesia": "Bahasa Indonesia",
  "indonesian": "Bahasa Indonesia",
  "id": "Bahasa Indonesia",
  "english": "English",
  "inggris": "English",
  "en": "English",
  "tetum": "Tetum (bahasa Timor Leste)",
  "timor": "Tetum (bahasa Timor Leste)"
};

async function translate(targetLang, text) {
  const langKey = targetLang.toLowerCase().trim();
  const langName = SUPPORTED_LANGUAGES[langKey] || targetLang;

  const prompt = `Terjemahkan teks berikut ke dalam ${langName}.
Pertahankan makna asli, tone, dan format.
Jika ada istilah teknis bisnis/konstruksi, gunakan padanan yang tepat.

TEKS ASLI:
${text.substring(0, 2000)}

TERJEMAHAN (${langName}):`;

  return await askClaude(prompt);
}

module.exports = { translate, SUPPORTED_LANGUAGES };
