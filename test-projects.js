require("dotenv").config({ path: "/root/ai-system/.env" });
process.chdir("/root/ai-system");

const results = [];
function pass(name) { results.push({ name, status: "✅ PASS" }); }
function fail(name, err) { results.push({ name, status: "❌ FAIL", error: err }); }

async function runTests() {
  // TEST 1: drive-scanner exports
  try {
    const ds = require("./core/projects/drive-scanner");
    ["sanitizeName","loadProjectStructure","findDesaFolder","getAllDesa","getAllProjects"].forEach(fn => {
      if (typeof ds[fn] !== "function") throw new Error(fn + " bukan function");
    });
    pass("drive-scanner exports");
  } catch(e) { fail("drive-scanner exports", e.message); }

  // TEST 2: sanitizeName
  try {
    const { sanitizeName } = require("./core/projects/drive-scanner");
    if (sanitizeName("DAPUR 3T") !== "DAPUR_3T") throw new Error("Expected DAPUR_3T");
    pass("sanitizeName");
  } catch(e) { fail("sanitizeName", e.message); }

  // TEST 3: getAllProjects
  try {
    const { getAllProjects } = require("./core/projects/drive-scanner");
    const projs = await getAllProjects();
    if (!Array.isArray(projs) || projs.length === 0) throw new Error("Empty projects");
    pass(`getAllProjects (${projs.length} proyek: ${projs.map(p=>p.nama).join(", ")})`);
  } catch(e) { fail("getAllProjects", e.message); }

  // TEST 4: loadProjectStructure
  try {
    const { loadProjectStructure } = require("./core/projects/drive-scanner");
    const proj = await loadProjectStructure("DAPUR 3T");
    if (!proj?.kabupaten?.length) throw new Error("No kabupaten");
    const totalDesa = proj.kabupaten.reduce((s, k) => s + (k.desa?.length || 0), 0);
    pass(`loadProjectStructure DAPUR 3T (${proj.kabupaten.length} kab, ${totalDesa} desa)`);
  } catch(e) { fail("loadProjectStructure", e.message); }

  // TEST 5: getRABForDesa
  try {
    const { getRABForDesa } = require("./core/projects/rab-reader");
    const rab = await getRABForDesa("DAPUR 3T", "Aitoun");
    if (!rab?.items?.length) throw new Error("No RAB items");
    pass(`getRABForDesa (${rab.items.length} items)`);
  } catch(e) { fail("getRABForDesa", e.message); }

  // TEST 6: parseSheetToRAB
  try {
    const { parseSheetToRAB } = require("./core/projects/rab-reader");
    const data = [
      ["No","Uraian Pekerjaan","Volume","Satuan","Harga Satuan","Jumlah"],
      ["1","Pembersihan Lokasi",100,"m2",50000,5000000],
      ["2","Pengecoran Pondasi",10,"m3",800000,8000000],
      ["","Jumlah Total","","","",13000000]
    ];
    const parsed = parseSheetToRAB(data);
    if (parsed.items[0].uraian !== "Pembersihan Lokasi") throw new Error("Wrong uraian");
    pass(`parseSheetToRAB (${parsed.items.length} items)`);
  } catch(e) { fail("parseSheetToRAB", e.message); }

  // TEST 7: progress-manager
  try {
    const { loadProgress, saveProgress } = require("./core/projects/progress-manager");
    const p0 = await loadProgress("TESTPROJ", "DESATEST");
    if (p0.bobot_terealisasi !== 0) throw new Error("Default should be 0");
    await saveProgress("TESTPROJ", "DESATEST", { items: { "Item A": { progress: 75 } } });
    const p1 = await loadProgress("TESTPROJ", "DESATEST");
    if (p1.items["Item A"]?.progress !== 75) throw new Error("Item not saved");
    pass("progress-manager save/load");
  } catch(e) { fail("progress-manager", e.message); }

  // TEST 8: buildProgressDashboard + progressBar
  try {
    const { buildProgressDashboard, progressBar } = require("./core/projects/report-generator");
    const bar = progressBar(50, 10);
    if (bar.length !== 10) throw new Error("Bar length wrong: " + bar.length);
    const dash = buildProgressDashboard("DAPUR 3T", [
      { desa: "Aitoun", bobot_terealisasi: 45.5, nilai_terealisasi: 5000000, foto_log: [] }
    ]);
    if (!dash.includes("DAPUR 3T") || !dash.includes("45.5")) throw new Error("Dashboard content wrong");
    pass("buildProgressDashboard + progressBar");
  } catch(e) { fail("buildProgressDashboard", e.message); }

  // TEST 9: generateDesaReport
  try {
    const { generateDesaReport } = require("./core/projects/report-generator");
    const result = await generateDesaReport("DAPUR 3T", "Aitoun");
    const fs = require("fs");
    if (!fs.existsSync(result.local_path)) throw new Error("File not created");
    const size = fs.statSync(result.local_path).size;
    if (size < 1000) throw new Error("File too small: " + size);
    pass(`generateDesaReport (${Math.round(size/1024)}KB)`);
  } catch(e) { fail("generateDesaReport", e.message); }

  // TEST 10: photo-placer exports
  try {
    const pp = require("./core/projects/photo-placer");
    ["handleIncomingPhoto","detectDesaFromCaption","getPendingPhoto","confirmPhotoPlacement","clearPendingPhoto"].forEach(fn => {
      if (typeof pp[fn] !== "function") throw new Error(fn + " bukan function");
    });
    pass("photo-placer exports");
  } catch(e) { fail("photo-placer exports", e.message); }

  // TEST 11: detectDesaFromCaption
  try {
    const { detectDesaFromCaption } = require("./core/projects/photo-placer");
    const r1 = await detectDesaFromCaption("foto desa aitoun pengecoran", "DAPUR 3T");
    if (!r1) throw new Error("Aitoun tidak terdeteksi");
    const r2 = await detectDesaFromCaption("pekerjaan dualasi minggu ini", "DAPUR 3T");
    if (!r2) throw new Error("Dualasi tidak terdeteksi");
    const r3 = await detectDesaFromCaption("xyzxyz tidak ada", "DAPUR 3T");
    pass(`detectDesaFromCaption (aitoun→${r1.nama}, dualasi→${r2?.nama || "n/a"}, unknown→${r3?.nama || "null"})`);
  } catch(e) { fail("detectDesaFromCaption", e.message); }

  // TEST 12: spreadsheet-updater exports
  try {
    const su = require("./core/projects/spreadsheet-updater");
    ["updateRABProgress","syncProgressToSheet","syncAllProgressToSheet"].forEach(fn => {
      if (typeof su[fn] !== "function") throw new Error(fn + " bukan function");
    });
    pass("spreadsheet-updater exports");
  } catch(e) { fail("spreadsheet-updater exports", e.message); }

  // TEST 13: image-analyzer exports & fallback
  try {
    const { analyzeProgressPhoto, formatAnalysisForTelegram } = require("./core/projects/image-analyzer");
    const result = await analyzeProgressPhoto("/nonexistent.jpg", "Aitoun", "DAPUR 3T", "test caption", "Tester");
    if (!result.pekerjaan_teridentifikasi) throw new Error("No pekerjaan_teridentifikasi");
    const formatted = formatAnalysisForTelegram(result, "Aitoun", "DAPUR 3T", "Tester");
    if (!formatted.includes("ANALISA PROGRESS")) throw new Error("Bad formatted output");
    pass("image-analyzer (fallback mode)");
  } catch(e) { fail("image-analyzer", e.message); }

  // TEST 14: notification-engine loads (tanpa setInterval, jadi cukup cek import)
  try {
    // Hanya cek syntax dan exports tanpa menjalankan
    const code = require("fs").readFileSync("./core/proactive/notification-engine.js", "utf8");
    if (!code.includes("sendWeeklyProjectReport")) throw new Error("sendWeeklyProjectReport tidak ada");
    if (!code.includes("sendMorningBrief")) throw new Error("sendMorningBrief tidak ada");
    pass("notification-engine (weekly project report terdaftar)");
  } catch(e) { fail("notification-engine", e.message); }

  // Cleanup
  require("fs-extra").remove("/root/ai-system/memory/projects/TESTPROJ").catch(() => {});

  // Print
  const div = "=".repeat(62);
  console.log("\n" + div);
  console.log("   TEST SUITE — PROJECT DOCUMENTATION SYSTEM v2.0");
  console.log(div);
  for (const r of results) {
    console.log(`${r.status}  ${r.name}`);
    if (r.error) console.log(`         ↳ ${r.error}`);
  }
  const passed = results.filter(r => r.status.includes("PASS")).length;
  const failed = results.filter(r => r.status.includes("FAIL")).length;
  console.log(div);
  console.log(`Total: ${results.length} | Lulus: ${passed} | Gagal: ${failed}`);
  console.log(div + "\n");
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => { console.error("Runner error:", err.message); process.exit(1); });
