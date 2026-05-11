require("dotenv").config();

const fs = require("fs-extra");
const path = require("path");
const { execFile } = require("child_process");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);
const TOOLS_DIR = "/root/ai-system/core/tools";

async function buildTool(toolName, description) {
  const safeName = toolName.replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-");
  const filePath = path.join(TOOLS_DIR, `${safeName}-tool.js`);

  // Generate kode tool dari template langsung (tidak panggil claude CLI sebagai subprocess)
  const fnName = `run${safeName.split("-").map(w => w[0].toUpperCase() + w.slice(1)).join("")}`;
  const code = `const askClaude = require("../providers/claude-pipe");

const SYSTEM_CONTEXT = \`Kamu adalah Ternion-AI, asisten strategis Brian Kinayom (Founder TERNION GROUP, Kupang NTT).
Tool ini khusus untuk: ${description}.
Berikan output terstruktur dengan perhitungan detail dan referensi harga NTT 2026.\`;

async function ${fnName}(input) {
  const prompt = \`${description.charAt(0).toUpperCase() + description.slice(1)}.

Detail dari Bry: \${input}

Berikan hasil yang komprehensif, terstruktur, dan praktis.
Sertakan tabel, perhitungan, dan estimasi biaya yang relevan untuk proyek di Kupang NTT.\`;
  return await askClaude(prompt, { systemContext: SYSTEM_CONTEXT });
}

module.exports = { ${fnName} };
`;
  await fs.ensureDir(TOOLS_DIR);
  await fs.writeFile(filePath, code, "utf8");

  try {
    await execFileAsync("node", ["--check", filePath], { timeout: 5000 });
  } catch (err) {
    await fs.remove(filePath);
    return `❌ Tool ${safeName} syntax error: ${err.message.substring(0, 200)}`;
  }

  // Log ke tool registry
  const registryPath = "/root/ai-system/memory/tool-registry.json";
  try {
    await fs.ensureFile(registryPath);
    let registry = await fs.readJson(registryPath).catch(() => []);
    if (!Array.isArray(registry)) registry = [];
    registry.push({
      name: safeName,
      description,
      file: filePath,
      created_at: new Date().toISOString()
    });
    await fs.writeJson(registryPath, registry, { spaces: 2 });
  } catch {}

  return `✅ Tool baru /${safeName} sudah aktif, Bry!\n\nDeskripsi: ${description}\nGunakan dengan: /${safeName} [input]`;
}

module.exports = { buildTool };
