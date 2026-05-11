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

  // Buat fungsi nama dari safeName (camelCase)
  const fnName = `run${safeName.split("-").map(w => w[0].toUpperCase() + w.slice(1)).join("")}`;

  // Generate kode skill dari template langsung (tidak panggil claude CLI sebagai subprocess)
  const code = `const askClaude = require("../providers/claude-pipe");

const SYSTEM_CONTEXT = \`Kamu adalah Ternion-AI, asisten strategis Brian Kinayom (Founder TERNION GROUP, Kupang NTT).
Skill ini khusus untuk: ${description}.
Konteks bisnis: procurement, konstruksi, trading komoditas NTT, ekspor-impor.\`;

async function ${fnName}(input) {
  const prompt = \`${description.charAt(0).toUpperCase() + description.slice(1)}.

Input dari Bry: \${input}

Berikan analisa yang detail, praktis, dan spesifik untuk konteks NTT/Kupang.
Sertakan estimasi biaya jika relevan.\`;
  return await askClaude(prompt, { systemContext: SYSTEM_CONTEXT });
}

module.exports = { ${fnName} };
`;

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
