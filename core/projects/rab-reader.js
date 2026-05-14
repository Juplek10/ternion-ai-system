require("dotenv").config();

const fs = require("fs-extra");
const path = require("path");
const XLSX = require("xlsx");
const { google, oauth2Client } = require("../integrations/google");
const { sanitizeName, PROGRESS_DIR } = require("./drive-scanner");

const TEMP_DIR = "/root/ai-system/workspace/temp";

function getDrive() {
  try {
    const token = JSON.parse(fs.readFileSync("/root/ai-system/tokens/google-token.json", "utf8"));
    oauth2Client.setCredentials(token);
    return google.drive({ version: "v3", auth: oauth2Client });
  } catch (err) {
    throw new Error("Google token tidak tersedia: " + err.message);
  }
}

async function downloadRABFile(fileId, mimeType, destPath) {
  const drive = getDrive();
  await fs.ensureDir(path.dirname(destPath));

  // Google Sheets → export as xlsx
  if (mimeType === "application/vnd.google-apps.spreadsheet") {
    const res = await drive.files.export(
      { fileId, mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
      { responseType: "arraybuffer" }
    );
    await fs.writeFile(destPath, Buffer.from(res.data));
  } else {
    // Regular xlsx download
    const res = await drive.files.get(
      { fileId, alt: "media" },
      { responseType: "arraybuffer" }
    );
    await fs.writeFile(destPath, Buffer.from(res.data));
  }
  return destPath;
}

// Deteksi baris header di sheet
function findHeaderRow(data) {
  const keywords = ["uraian", "pekerjaan", "no", "nomor", "volume", "satuan", "harga", "jumlah"];
  for (let i = 0; i < Math.min(data.length, 15); i++) {
    const row = data[i];
    if (!row) continue;
    const rowStr = row.map(c => String(c || "").toLowerCase()).join("|");
    const matches = keywords.filter(k => rowStr.includes(k));
    if (matches.length >= 3) return i;
  }
  return 0;
}

// Deteksi kolom kunci dari header row
function detectColumns(headerRow) {
  const cols = {};
  const headers = headerRow.map((h, i) => ({ idx: i, val: String(h || "").toLowerCase().trim() }));

  for (const h of headers) {
    const v = h.val;
    if (!cols.no && (v === "no" || v === "nomor" || v === "no.")) cols.no = h.idx;
    if (!cols.uraian && (v.includes("uraian") || v.includes("pekerjaan") || v.includes("deskripsi"))) cols.uraian = h.idx;
    if (!cols.volume && (v === "volume" || v === "vol" || v === "qty" || v === "kuantitas")) cols.volume = h.idx;
    if (!cols.satuan && (v === "satuan" || v === "sat" || v === "unit")) cols.satuan = h.idx;
    if (!cols.harga_satuan && (v.includes("harga") || v.includes("h.sat") || v.includes("unit price"))) cols.harga_satuan = h.idx;
    if (!cols.jumlah && (v === "jumlah" || v === "total" || v.includes("nilai") || v === "amount")) cols.jumlah = h.idx;
    if (!cols.bobot && (v.includes("bobot") || v.includes("berat") || v === "%")) cols.bobot = h.idx;
  }

  // Fallback deteksi dari posisi
  if (cols.harga_satuan === undefined && cols.volume !== undefined && cols.satuan !== undefined) {
    cols.harga_satuan = (cols.satuan || 0) + 1;
    cols.jumlah = (cols.harga_satuan || 0) + 1;
  }

  return cols;
}

function isNumeric(val) {
  if (val === null || val === undefined || val === "") return false;
  return !isNaN(parseFloat(String(val).replace(/[.,]/g, ".")));
}

function parseNum(val) {
  if (!val && val !== 0) return 0;
  const s = String(val).replace(/[Rp.,\s]/g, "").replace(",", ".");
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function isCategoryRow(row, cols) {
  const uraian = String(row[cols.uraian] || "").trim();
  const noVal = row[cols.no] !== undefined ? String(row[cols.no] || "").trim() : "";
  const jumlah = cols.jumlah !== undefined ? parseNum(row[cols.jumlah]) : 0;
  const volume = cols.volume !== undefined ? parseNum(row[cols.volume]) : 0;

  // Kategori jika: no berupa huruf/romawi, volume 0, atau uraian berbentuk judul
  return (
    (/^[IVXLCA-Z]/.test(noVal) && noVal.length <= 4) ||
    (volume === 0 && jumlah === 0 && uraian.length > 3) ||
    (/^[A-Z\s]{4,}$/.test(uraian) && uraian === uraian.toUpperCase())
  );
}

function parseSheetToRAB(sheetData) {
  if (!sheetData || sheetData.length === 0) return null;

  const headerIdx = findHeaderRow(sheetData);
  const headerRow = sheetData[headerIdx] || [];
  const cols = detectColumns(headerRow);

  if (cols.uraian === undefined) {
    // Fallback: gunakan kolom pertama sebagai no, kedua sebagai uraian
    cols.no = 0;
    cols.uraian = 1;
    cols.volume = 2;
    cols.satuan = 3;
    cols.harga_satuan = 4;
    cols.jumlah = 5;
  }

  const items = [];
  let totalNilai = 0;

  for (let i = headerIdx + 1; i < sheetData.length; i++) {
    const row = sheetData[i];
    if (!row) continue;

    const uraian = String(row[cols.uraian] || "").trim();
    if (!uraian || uraian.toLowerCase().includes("jumlah total") ||
        uraian.toLowerCase() === "jumlah" || uraian.toLowerCase() === "total") {
      // Baris total
      const total = cols.jumlah !== undefined ? parseNum(row[cols.jumlah]) : 0;
      if (total > totalNilai) totalNilai = total;
      continue;
    }

    const noVal = cols.no !== undefined ? String(row[cols.no] || "").trim() : String(i);
    const volume = cols.volume !== undefined ? parseNum(row[cols.volume]) : 0;
    const satuan = cols.satuan !== undefined ? String(row[cols.satuan] || "").trim() : "";
    const hargaSatuan = cols.harga_satuan !== undefined ? parseNum(row[cols.harga_satuan]) : 0;
    const jumlah = cols.jumlah !== undefined ? parseNum(row[cols.jumlah]) : volume * hargaSatuan;
    const bobotRaw = cols.bobot !== undefined ? parseNum(row[cols.bobot]) : 0;

    if (jumlah > 0 && totalNilai < jumlah) totalNilai = Math.max(totalNilai, jumlah * 1.1);

    items.push({
      no: noVal,
      uraian,
      volume,
      satuan,
      harga_satuan: hargaSatuan,
      jumlah,
      bobot: bobotRaw,
      is_kategori: isCategoryRow(row, cols),
      progress_persen: 0
    });
  }

  // Hitung bobot jika belum ada
  if (totalNilai === 0) {
    totalNilai = items.filter(it => !it.is_kategori).reduce((sum, it) => sum + it.jumlah, 0);
  }
  for (const item of items) {
    if (item.bobot === 0 && totalNilai > 0 && !item.is_kategori) {
      item.bobot = parseFloat(((item.jumlah / totalNilai) * 100).toFixed(4));
    }
  }

  return { items, total_nilai: totalNilai };
}

async function downloadAndParseRAB(rabFileId, projectName, mimeType) {
  const projDir = path.join(PROGRESS_DIR, sanitizeName(projectName));
  await fs.ensureDir(projDir);
  const destPath = path.join(TEMP_DIR, `rab_${sanitizeName(projectName)}.xlsx`);
  await fs.ensureDir(TEMP_DIR);

  console.log(`[RAB] Downloading RAB untuk ${projectName}...`);
  await downloadRABFile(rabFileId, mimeType || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", destPath);

  console.log(`[RAB] Parsing ${destPath}...`);
  const workbook = XLSX.readFile(destPath);
  const sheetNames = workbook.SheetNames;

  // Cari sheet RAB utama
  const rabSheetName =
    sheetNames.find(s => /^rab$/i.test(s.trim())) ||
    sheetNames.find(s => /rekapitulasi/i.test(s)) ||
    sheetNames.find(s => /rekap/i.test(s)) ||
    sheetNames.find(s => /rab/i.test(s)) ||
    sheetNames[0];

  const allSheetsParsed = {};

  for (const sName of sheetNames) {
    try {
      const ws = workbook.Sheets[sName];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
      const parsed = parseSheetToRAB(data);
      if (parsed && parsed.items.length > 0) {
        allSheetsParsed[sName] = parsed;
      }
    } catch {}
  }

  const mainRAB = allSheetsParsed[rabSheetName] ||
    Object.values(allSheetsParsed).sort((a, b) => b.items.length - a.items.length)[0];

  if (!mainRAB) throw new Error("Tidak bisa parse RAB dari file");

  const result = {
    project: projectName,
    file_id: rabFileId,
    parsed_at: new Date().toISOString(),
    total_nilai: mainRAB.total_nilai,
    mata_uang: "IDR",
    items: mainRAB.items,
    sheets: Object.keys(allSheetsParsed),
    per_desa_sheets: Object.entries(allSheetsParsed)
      .filter(([n]) => n !== rabSheetName)
      .map(([n, d]) => ({ sheet: n, total_nilai: d.total_nilai, item_count: d.items.length }))
  };

  // Simpan ke memory
  await fs.writeJson(path.join(projDir, "rab.json"), result, { spaces: 2 });
  console.log(`[RAB] Selesai: ${result.items.length} item, total Rp${result.total_nilai.toLocaleString("id-ID")}`);

  return result;
}

async function getRABForDesa(projectName, desaName) {
  const projDir = path.join(PROGRESS_DIR, sanitizeName(projectName));
  const rabFile = path.join(projDir, "rab.json");
  if (!await fs.pathExists(rabFile)) return null;

  const rab = await fs.readJson(rabFile);

  // Coba cari sheet per desa
  if (rab.per_desa_sheets && rab.per_desa_sheets.length > 0 && desaName) {
    const Fuse = require("fuse.js");
    const fuse = new Fuse(rab.per_desa_sheets, { keys: ["sheet"], threshold: 0.4 });
    const match = fuse.search(desaName);
    if (match.length > 0) {
      // Load dari sheet spesifik
      const destPath = path.join(TEMP_DIR, `rab_${sanitizeName(projectName)}.xlsx`);
      if (await fs.pathExists(destPath)) {
        const wb = XLSX.readFile(destPath);
        const ws = wb.Sheets[match[0].item.sheet];
        if (ws) {
          const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
          const parsed = parseSheetToRAB(data);
          if (parsed) return { ...rab, ...parsed, sheet_nama: match[0].item.sheet };
        }
      }
    }
  }

  return rab;
}

async function getRABSummary(projectName) {
  const projDir = path.join(PROGRESS_DIR, sanitizeName(projectName));
  const rabFile = path.join(projDir, "rab.json");
  if (!await fs.pathExists(rabFile)) return null;
  const rab = await fs.readJson(rabFile);
  return {
    total_nilai: rab.total_nilai,
    item_count: rab.items?.length || 0,
    sheets: rab.sheets || [],
    per_desa: rab.per_desa_sheets || []
  };
}

module.exports = {
  downloadAndParseRAB,
  getRABForDesa,
  getRABSummary,
  parseSheetToRAB
};
