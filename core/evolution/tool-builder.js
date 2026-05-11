require("dotenv").config();

const fs = require("fs-extra");
const path = require("path");
const { execFile } = require("child_process");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);
const TOOLS_DIR = "/root/ai-system/core/tools";

async function buildTool(toolName, description) {
  const safeName = toolName.replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-");
  const filePath = path.join(TOOLS_DIR, `${toolName}-tool.js`);

  const genPrompt = `Kamu adalah developer Node.js senior yang membuat tool module untuk sistem AI bisnis.

Buat file JavaScript untuk tool baru:
- Nama tool: ${safeName}
- Deskripsi: ${description}
- Konteks: TERNION GROUP, Brian Kinayom, Kupang NTT

TEMPLATE yang harus diikuti:
\`\`\`javascript
const askClaude = require("../providers/claude-pipe");

const SYSTEM_CONTEXT = \`[system context yang relevan]\`;

async function run${safeName.split("-").map(w => w[0].toUpperCase() + w.slice(1)).join("")}(input) {
  const prompt = \`[prompt template berdasarkan deskripsi: ${description}]

Input: \${input}

[format output yang diharapkan]\`;

  return await askClaude(prompt, { systemContext: SYSTEM_CONTEXT });
}

module.exports = { run${safeName.split("-").map(w => w[0].toUpperCase() + w.slice(1)).join("")} };
\`\`\`

Tulis kode JavaScript lengkap saja. Mulai langsung dengan \`const askClaude\`.`;

  let code;
  try {
    const { stdout } = await execFileAsync(
      "claude",
      ["-p", genPrompt, "--output-format", "text"],
      { timeout: 60000, maxBuffer: 1024 * 1024 * 4 }
    );
    code = stdout.trim();
    const codeMatch = code.match(/```(?:javascript|js)?\n([\s\S]+?)```/);
    if (codeMatch) code = codeMatch[1].trim();
    if (!code.includes("askClaude")) {
      return `❌ Generate tool gagal — format tidak valid`;
    }
  } catch (err) {
    return `❌ Claude error: ${err.message}`;
  }

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
