require("dotenv").config();

const fs = require("fs-extra");
const path = require("path");
const { execFile } = require("child_process");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);
const SKILLS_DIR = "/root/ai-system/core/skills";

async function buildSkill(skillName, description) {
  // Sanitize nama
  const safeName = skillName.replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-");
  const filePath = path.join(SKILLS_DIR, `${safeName}-skill.js`);

  const genPrompt = `Kamu adalah developer Node.js senior yang membuat skill module untuk sistem AI bisnis.

Buat file JavaScript untuk skill baru dengan spesifikasi:
- Nama skill: ${safeName}
- Deskripsi: ${description}
- Konteks: Digunakan oleh Brian Kinayom (TERNION GROUP, Kupang NTT)

TEMPLATE yang harus diikuti PERSIS:
\`\`\`javascript
const askClaude = require("../providers/claude-pipe");

const SYSTEM_CONTEXT = \`[TULIS system context yang relevan untuk skill ini]\`;

async function run${safeName.split("-").map(w => w[0].toUpperCase() + w.slice(1)).join("")}(input) {
  const prompt = \`[TULIS prompt template yang lengkap untuk skill ini berdasarkan deskripsi]\`;
  return await askClaude(prompt, { systemContext: SYSTEM_CONTEXT });
}

module.exports = { run${safeName.split("-").map(w => w[0].toUpperCase() + w.slice(1)).join("")} };
\`\`\`

Tulis kode JavaScript lengkap saja, tanpa penjelasan. Mulai langsung dengan \`const askClaude\`.`;

  let code;
  try {
    const { stdout } = await execFileAsync(
      "claude",
      ["-p", genPrompt, "--output-format", "text"],
      { timeout: 60000, maxBuffer: 1024 * 1024 * 4 }
    );
    // Extract code dari markdown block jika ada
    code = stdout.trim();
    const codeMatch = code.match(/```(?:javascript|js)?\n([\s\S]+?)```/);
    if (codeMatch) code = codeMatch[1].trim();
    if (!code.startsWith("const") && !code.startsWith("require")) {
      return `❌ Claude menghasilkan format yang tidak valid untuk skill ${safeName}`;
    }
  } catch (err) {
    return `❌ Claude error saat generate skill: ${err.message}`;
  }

  // Tulis file
  await fs.ensureDir(SKILLS_DIR);
  await fs.writeFile(filePath, code, "utf8");

  // Verify syntax dengan node --check
  try {
    await execFileAsync("node", ["--check", filePath], { timeout: 5000 });
  } catch (err) {
    await fs.remove(filePath);
    return `❌ Skill ${safeName} gagal syntax check: ${err.message.substring(0, 200)}`;
  }

  // Log ke skill registry
  const registryPath = "/root/ai-system/memory/skill-registry.json";
  try {
    await fs.ensureFile(registryPath);
    let registry = await fs.readJson(registryPath).catch(() => []);
    if (!Array.isArray(registry)) registry = [];
    registry.push({
      name: safeName,
      description,
      file: filePath,
      created_at: new Date().toISOString(),
      command: `/${safeName}`
    });
    await fs.writeJson(registryPath, registry, { spaces: 2 });
  } catch {}

  return `✅ Skill baru /${safeName} sudah aktif, Bry!\n\nDeskripsi: ${description}\nFile: ${filePath}\n\nGunakan dengan: /${safeName} [input kamu]`;
}

// Dynamic skill runner — dipanggil dari telegram.js saat user ketik /[nama-skill]
async function runDynamicSkill(skillName, input) {
  const safeName = skillName.replace(/[^a-z0-9-]/g, "-");
  const filePath = path.join(SKILLS_DIR, `${safeName}-skill.js`);
  if (!(await fs.pathExists(filePath))) {
    return null; // Skill tidak ada
  }
  try {
    delete require.cache[require.resolve(filePath)];
    const skill = require(filePath);
    const fnName = `run${safeName.split("-").map(w => w[0].toUpperCase() + w.slice(1)).join("")}`;
    if (typeof skill[fnName] !== "function") {
      const fns = Object.values(skill).filter(f => typeof f === "function");
      if (fns.length > 0) return await fns[0](input);
      return null;
    }
    return await skill[fnName](input);
  } catch (err) {
    console.error(`[SKILL-BUILDER] Error running ${skillName}:`, err.message);
    return null;
  }
}

// List semua dynamic skills
async function listDynamicSkills() {
  const registryPath = "/root/ai-system/memory/skill-registry.json";
  try {
    return await fs.readJson(registryPath).catch(() => []);
  } catch {
    return [];
  }
}

module.exports = { buildSkill, runDynamicSkill, listDynamicSkills };
