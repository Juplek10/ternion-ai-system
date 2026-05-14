require("dotenv").config();

const fs = require("fs-extra");
const path = require("path");
const { sanitizeName, PROGRESS_DIR } = require("./drive-scanner");

function progressFile(projectName, desaName) {
  return path.join(PROGRESS_DIR, sanitizeName(projectName), "progress", `${sanitizeName(desaName)}.json`);
}

async function loadProgress(projectName, desaName) {
  const f = progressFile(projectName, desaName);
  if (!await fs.pathExists(f)) {
    return {
      project: projectName,
      desa: desaName,
      bobot_terealisasi: 0,
      nilai_terealisasi: 0,
      items: {},
      foto_log: [],
      last_update: null
    };
  }
  return await fs.readJson(f);
}

async function saveProgress(projectName, desaName, data) {
  const f = progressFile(projectName, desaName);
  await fs.ensureDir(path.dirname(f));
  const existing = await loadProgress(projectName, desaName);
  const merged = {
    ...existing,
    ...data,
    project: projectName,
    desa: desaName,
    last_update: new Date().toISOString()
  };
  if (data.items) {
    merged.items = { ...existing.items, ...data.items };
  }
  if (data.foto_entry) {
    merged.foto_log = [...(existing.foto_log || []), data.foto_entry].slice(-50);
    delete merged.foto_entry;
  }
  await fs.writeJson(f, merged, { spaces: 2 });
  return merged;
}

async function updateItemProgress(projectName, desaName, itemUraian, progressPersen) {
  const prev = await loadProgress(projectName, desaName);
  const prevPersen = prev.items[itemUraian]?.progress || 0;

  const updated = await saveProgress(projectName, desaName, {
    items: {
      [itemUraian]: {
        progress: progressPersen,
        updated_at: new Date().toISOString(),
        prev_progress: prevPersen
      }
    }
  });

  // Hitung ulang total bobot terealisasi
  const { getRABForDesa } = require("./rab-reader");
  const rab = await getRABForDesa(projectName, desaName).catch(() => null);
  if (rab && rab.items) {
    let totalBobot = 0;
    let totalNilai = 0;
    for (const item of rab.items.filter(i => !i.is_kategori)) {
      const pct = updated.items[item.uraian]?.progress || 0;
      totalBobot += (item.bobot * pct) / 100;
      totalNilai += item.jumlah * (pct / 100);
    }
    updated.bobot_terealisasi = parseFloat(totalBobot.toFixed(2));
    updated.nilai_terealisasi = Math.round(totalNilai);
    await fs.writeJson(progressFile(projectName, desaName), updated, { spaces: 2 });
  }

  return updated;
}

async function getAllProgress(projectName) {
  const projDir = path.join(PROGRESS_DIR, sanitizeName(projectName), "progress");
  if (!await fs.pathExists(projDir)) return [];
  const files = await fs.readdir(projDir);
  const result = [];
  for (const f of files.filter(f => f.endsWith(".json"))) {
    try {
      const data = await fs.readJson(path.join(projDir, f));
      result.push(data);
    } catch {}
  }
  return result;
}

module.exports = {
  loadProgress,
  saveProgress,
  updateItemProgress,
  getAllProgress
};
