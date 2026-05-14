require("dotenv").config();

const fs = require("fs-extra");
const path = require("path");
const { google, oauth2Client } = require("../integrations/google");

const INDEX_FILE = "/root/ai-system/memory/projects/index.json";
const PROGRESS_DIR = "/root/ai-system/memory/projects";

// Known project roots based on Drive scan
const KNOWN_ROOTS = [
  { id: "1gutDOR0jq9aMdcGgXp3BiT4XBcEQv4vP", nama: "DAPUR 3T", type: "kab_direct" },
  { id: "1QgCesxuaNbGPgmEy7sMCCTrUC1cDj4EE", nama: "BGN NTT",  type: "kab_folder" }
];

function getDrive() {
  try {
    const token = JSON.parse(fs.readFileSync("/root/ai-system/tokens/google-token.json", "utf8"));
    oauth2Client.setCredentials(token);
    return google.drive({ version: "v3", auth: oauth2Client });
  } catch (err) {
    throw new Error("Google token tidak tersedia: " + err.message);
  }
}

async function listChildren(drive, folderId, pageToken = null) {
  const params = {
    q: `'${folderId}' in parents and trashed=false`,
    fields: "nextPageToken,files(id,name,mimeType,size,modifiedTime,createdTime)",
    pageSize: 100,
    orderBy: "name"
  };
  if (pageToken) params.pageToken = pageToken;
  const res = await drive.files.list(params);
  let files = res.data.files || [];
  if (res.data.nextPageToken) {
    const more = await listChildren(drive, folderId, res.data.nextPageToken);
    files = files.concat(more);
  }
  return files;
}

function isFolder(f) { return f.mimeType === "application/vnd.google-apps.folder"; }
function isImage(f) { return f.mimeType && f.mimeType.startsWith("image/"); }
function isSpreadsheet(f) {
  return f.mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
         f.mimeType === "application/vnd.google-apps.spreadsheet" ||
         (f.name && /\.xlsx?$/i.test(f.name));
}
function isPDF(f) { return f.mimeType === "application/pdf" || (f.name && /\.pdf$/i.test(f.name)); }
function isContract(f) {
  const n = (f.name || "").toLowerCase();
  return n.includes("kontrak") || n.includes("spk") || n.includes("perjanjian");
}
function isRAB(f) {
  const n = (f.name || "").toLowerCase();
  return n.includes("rab") && (isSpreadsheet(f) || f.mimeType === "application/vnd.google-apps.spreadsheet");
}

// Scan folder DESA - ambil foto langsung atau dari subfolder tanggal
async function scanDesaFolder(drive, desaId, desaNama) {
  const children = await listChildren(drive, desaId);
  const foto = [];
  const subFolders = children.filter(isFolder);
  const directFiles = children.filter(f => !isFolder(f));

  // Foto langsung di folder desa
  for (const f of directFiles.filter(isImage)) {
    foto.push({
      id: f.id,
      nama: f.name,
      tanggal: f.createdTime || f.modifiedTime,
      pengirim: null,
      drive_folder: desaId
    });
  }

  // Foto di subfolder tanggal (e.g. "11-04-26")
  for (const sub of subFolders) {
    if (/^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}$/.test(sub.name)) {
      try {
        const subFiles = await listChildren(drive, sub.id);
        for (const f of subFiles.filter(isImage)) {
          foto.push({
            id: f.id,
            nama: f.name,
            tanggal: sub.name, // tanggal dari nama folder
            pengirim: null,
            drive_folder: sub.id,
            parent_folder_nama: sub.name
          });
        }
      } catch {}
    }
  }

  return { foto, total_foto: foto.length };
}

// Scan proyek dengan structure: Project > Kabupaten > Desa
async function scanProjectKabDesa(drive, projectId, projectNama) {
  const kabFolders = (await listChildren(drive, projectId)).filter(isFolder);
  const projectFiles = (await listChildren(drive, projectId)).filter(f => !isFolder(f));

  const kabupatenList = [];
  let rabFile = null;
  const otherFiles = [];

  // Identifikasi file-file proyek
  for (const f of projectFiles) {
    if (isRAB(f)) { rabFile = { id: f.id, nama: f.name, mimeType: f.mimeType }; }
    else if (isContract(f)) { otherFiles.push({ id: f.id, nama: f.name, type: "kontrak" }); }
    else { otherFiles.push({ id: f.id, nama: f.name, type: "lainnya" }); }
  }

  for (const kab of kabFolders) {
    // Skip non-kabupaten folders
    if (kab.name.toLowerCase().includes("dokumentasi") ||
        kab.name.toLowerCase().includes("precast") ||
        kab.name.startsWith("##")) continue;

    const desaFolders = (await listChildren(drive, kab.id)).filter(isFolder);
    const kabFiles = (await listChildren(drive, kab.id)).filter(f => !isFolder(f));

    // Cari RAB di level kabupaten juga
    for (const f of kabFiles) {
      if (isRAB(f) && !rabFile) { rabFile = { id: f.id, nama: f.name, mimeType: f.mimeType }; }
    }

    const desaList = [];
    for (const desa of desaFolders) {
      if (desa.name.toLowerCase().includes("nonteknis")) continue;
      try {
        const { foto, total_foto } = await scanDesaFolder(drive, desa.id, desa.name);
        desaList.push({
          nama: desa.name,
          drive_id: desa.id,
          foto,
          total_foto,
          progress: {
            last_update: null,
            bobot_terealisasi: 0,
            nilai_terealisasi: 0,
            items: {}
          }
        });
      } catch (err) {
        console.error(`[SCANNER] Skip desa ${desa.name}: ${err.message}`);
        desaList.push({
          nama: desa.name,
          drive_id: desa.id,
          foto: [],
          total_foto: 0,
          progress: { last_update: null, bobot_terealisasi: 0, nilai_terealisasi: 0, items: {} }
        });
      }
    }

    kabupatenList.push({
      nama: kab.name,
      drive_id: kab.id,
      desa: desaList
    });
  }

  return { kabupatenList, rabFile, otherFiles };
}

async function scanProjectStructure(projectId, projectNama) {
  const drive = getDrive();
  console.log(`[SCANNER] Scanning: ${projectNama}...`);

  const { kabupatenList, rabFile, otherFiles } = await scanProjectKabDesa(drive, projectId, projectNama);

  let totalFoto = 0;
  let totalDesa = 0;
  for (const kab of kabupatenList) {
    for (const desa of kab.desa) {
      totalFoto += desa.total_foto;
      totalDesa++;
    }
  }

  const project = {
    nama: projectNama,
    drive_id: projectId,
    files: {
      rab: rabFile,
      kontrak: otherFiles.find(f => f.type === "kontrak") || null,
      lainnya: otherFiles.filter(f => f.type === "lainnya")
    },
    kabupaten: kabupatenList,
    rab_parsed: null,
    total_nilai: 0,
    total_desa: totalDesa,
    total_foto: totalFoto,
    last_scan: new Date().toISOString()
  };

  // Simpan ke file per proyek
  const projDir = path.join(PROGRESS_DIR, sanitizeName(projectNama));
  await fs.ensureDir(projDir);
  await fs.writeJson(path.join(projDir, "structure.json"), project, { spaces: 2 });

  return project;
}

function sanitizeName(name) {
  return name.replace(/[^a-zA-Z0-9_\-]/g, "_").substring(0, 50);
}

async function autoDetectAllProjects() {
  console.log("[SCANNER] Memulai scan semua proyek...");
  const projects = [];

  for (const root of KNOWN_ROOTS) {
    try {
      const proj = await scanProjectStructure(root.id, root.nama);
      projects.push({
        nama: proj.nama,
        drive_id: proj.drive_id,
        total_desa: proj.total_desa,
        total_foto: proj.total_foto,
        has_rab: !!proj.files.rab,
        rab_name: proj.files.rab?.nama || null,
        kabupaten: proj.kabupaten.map(k => ({
          nama: k.nama,
          total_desa: k.desa.length
        })),
        last_scan: proj.last_scan
      });
    } catch (err) {
      console.error(`[SCANNER] Gagal scan ${root.nama}: ${err.message}`);
    }
  }

  // Simpan index
  await fs.ensureDir(PROGRESS_DIR);
  await fs.writeJson(INDEX_FILE, { projects, last_scan: new Date().toISOString() }, { spaces: 2 });

  console.log(`[SCANNER] Selesai. Ditemukan ${projects.length} proyek.`);
  return projects;
}

async function findDesaFolder(projectName, desaName) {
  const Fuse = require("fuse.js");
  const projDir = path.join(PROGRESS_DIR, sanitizeName(projectName));
  const structFile = path.join(projDir, "structure.json");

  if (!await fs.pathExists(structFile)) return null;
  const proj = await fs.readJson(structFile);

  const allDesa = [];
  for (const kab of proj.kabupaten || []) {
    for (const desa of kab.desa || []) {
      allDesa.push({ nama: desa.nama, drive_id: desa.drive_id, kab: kab.nama });
    }
  }

  const fuse = new Fuse(allDesa, { keys: ["nama"], threshold: 0.4 });
  const results = fuse.search(desaName);
  if (results.length === 0) return null;
  return results[0].item;
}

async function getAllDesa(projectName) {
  const projDir = path.join(PROGRESS_DIR, sanitizeName(projectName));
  const structFile = path.join(projDir, "structure.json");
  if (!await fs.pathExists(structFile)) return [];
  const proj = await fs.readJson(structFile);
  const desas = [];
  for (const kab of proj.kabupaten || []) {
    for (const desa of kab.desa || []) {
      desas.push({ nama: desa.nama, drive_id: desa.drive_id, kab: kab.nama });
    }
  }
  return desas;
}

async function loadProjectStructure(projectName) {
  const projDir = path.join(PROGRESS_DIR, sanitizeName(projectName));
  const structFile = path.join(projDir, "structure.json");
  if (!await fs.pathExists(structFile)) return null;
  return await fs.readJson(structFile);
}

async function getAllProjects() {
  if (!await fs.pathExists(INDEX_FILE)) return [];
  const idx = await fs.readJson(INDEX_FILE).catch(() => ({ projects: [] }));
  return idx.projects || [];
}

module.exports = {
  scanProjectStructure,
  autoDetectAllProjects,
  findDesaFolder,
  getAllDesa,
  getAllProjects,
  loadProjectStructure,
  sanitizeName,
  PROGRESS_DIR
};
