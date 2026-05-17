require("dotenv").config();

const express = require("express");
const fs = require("fs");
const https = require("https");
const app = express();

app.use(express.json());

// ── AUTH MIDDLEWARE
const AUTH_TOKEN = process.env.GATEWAY_TOKEN;
app.use((req, res, next) => {
  if (req.path === "/api/health") return next();
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (token !== AUTH_TOKEN) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
});

// ── RATE LIMIT SEDERHANA
const requests = {};
app.use((req, res, next) => {
  const ip = req.ip;
  const now = Date.now();
  if (!requests[ip]) requests[ip] = [];
  requests[ip] = requests[ip].filter(t => now - t < 60000);
  if (requests[ip].length > 60) {
    return res.status(429).json({ error: "Rate limit exceeded" });
  }
  requests[ip].push(now);
  next();
});

// ══════════════════════════════════════
// ENDPOINTS
// ══════════════════════════════════════

// GET /api/health
app.get("/api/health", (req, res) => {
  res.json({
    status: "online",
    system: "TERNION COWORK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// GET /api/memory/:domain
app.get("/api/memory/:domain", (req, res) => {
  const { domain } = req.params;
  const allowed = ["bisnis", "proyek", "kontak", "keuangan", "keputusan", "percakapan"];
  if (!allowed.includes(domain)) {
    return res.status(400).json({ error: "Domain tidak valid" });
  }
  const fpath = `/root/ai-system/memory/${domain}.json`;
  if (!fs.existsSync(fpath)) {
    return res.json({ domain, data: {} });
  }
  try {
    const data = JSON.parse(fs.readFileSync(fpath, "utf8"));
    res.json({ domain, data });
  } catch (e) {
    res.status(500).json({ error: "Gagal baca memory: " + e.message });
  }
});

// GET /api/memory (semua)
app.get("/api/memory", (req, res) => {
  const domains = ["bisnis", "proyek", "kontak", "keuangan", "keputusan"];
  const result = {};
  for (const d of domains) {
    const fpath = `/root/ai-system/memory/${d}.json`;
    try {
      result[d] = fs.existsSync(fpath)
        ? JSON.parse(fs.readFileSync(fpath, "utf8"))
        : {};
    } catch {
      result[d] = {};
    }
  }
  res.json(result);
});

// POST /api/memory/update
app.post("/api/memory/update", (req, res) => {
  const { domain, key, value } = req.body;
  const allowed = ["bisnis", "proyek", "kontak", "keuangan", "keputusan"];
  if (!allowed.includes(domain)) {
    return res.status(400).json({ error: "Domain tidak valid" });
  }
  const fpath = `/root/ai-system/memory/${domain}.json`;
  try {
    const data = fs.existsSync(fpath)
      ? JSON.parse(fs.readFileSync(fpath, "utf8"))
      : {};
    data[key] = value;
    data._updated = new Date().toISOString();
    fs.writeFileSync(fpath, JSON.stringify(data, null, 2));
    res.json({ success: true, domain, key });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/proyek
app.get("/api/proyek", (req, res) => {
  const fpath = "/root/ai-system/memory/proyek.json";
  try {
    const data = fs.existsSync(fpath)
      ? JSON.parse(fs.readFileSync(fpath, "utf8"))
      : {};
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/kontak
app.get("/api/kontak", (req, res) => {
  const fpath = "/root/ai-system/memory/kontak.json";
  try {
    const data = fs.existsSync(fpath)
      ? JSON.parse(fs.readFileSync(fpath, "utf8"))
      : {};
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/wa/messages
app.get("/api/wa/messages", (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  const fpath = "/root/ai-system/memory/percakapan.json";
  try {
    const data = fs.existsSync(fpath)
      ? JSON.parse(fs.readFileSync(fpath, "utf8"))
      : { entries: [] };
    const recent = (data.entries || []).slice(-limit);
    res.json({ messages: recent, total: data.entries?.length || 0 });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/wa/send
app.post("/api/wa/send", (req, res) => {
  const { nomor, pesan } = req.body;
  if (!nomor || !pesan) {
    return res.status(400).json({ error: "nomor dan pesan diperlukan" });
  }
  try {
    const queue_path = "/root/ai-system/workspace/wa-queue.json";
    let queue = { items: [] };
    if (fs.existsSync(queue_path)) {
      try { queue = JSON.parse(fs.readFileSync(queue_path, "utf8")); } catch {}
    }
    if (!Array.isArray(queue.items)) queue.items = [];
    queue.items.push({
      id: Date.now(),
      nomor,
      pesan,
      timestamp: new Date().toISOString(),
      status: "pending"
    });
    fs.writeFileSync(queue_path, JSON.stringify(queue, null, 2));
    res.json({ success: true, queued: true, nomor });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/tools/biteship
app.post("/api/tools/biteship", async (req, res) => {
  const { origin_postal_code, destination_city, weight_gram, length_cm, width_cm, height_cm } = req.body;
  const KEY = process.env.BITESHIP_API_KEY;
  if (!KEY) return res.status(500).json({ error: "BITESHIP_API_KEY tidak dikonfigurasi" });
  if (!destination_city || !weight_gram) {
    return res.status(400).json({ error: "destination_city dan weight_gram diperlukan" });
  }

  try {
    const enc = encodeURIComponent(destination_city);
    const areaData = await new Promise((resolve, reject) => {
      https.get({
        hostname: "api.biteship.com",
        path: `/v1/maps/areas?countries=ID&input=${enc}&type=single`,
        headers: { Authorization: KEY }
      }, r => {
        let d = "";
        r.on("data", c => d += c);
        r.on("end", () => { try { resolve(JSON.parse(d)); } catch { reject(new Error("Parse area gagal")); } });
      }).on("error", reject);
    });

    if (!areaData.success || !areaData.areas?.length) {
      return res.json({ error: "Area tidak ditemukan: " + destination_city });
    }

    const area_id = areaData.areas[0].id;

    const body = JSON.stringify({
      origin_postal_code: origin_postal_code || 10110,
      destination_area_id: area_id,
      couriers: "jnt,lion,jne,sicepat,anteraja",
      items: [{
        name: "Paket TERNION",
        value: 100000,
        length: length_cm || 30,
        width: width_cm || 20,
        height: height_cm || 15,
        weight: weight_gram
      }]
    });

    const rateData = await new Promise((resolve, reject) => {
      const r = https.request({
        hostname: "api.biteship.com",
        path: "/v1/rates/couriers",
        method: "POST",
        headers: {
          Authorization: KEY,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body)
        }
      }, res => {
        let d = "";
        res.on("data", c => d += c);
        res.on("end", () => { try { resolve(JSON.parse(d)); } catch { reject(new Error("Parse rate gagal")); } });
      });
      r.on("error", reject);
      r.write(body);
      r.end();
    });

    if (!rateData.success) {
      return res.json({ error: rateData.error || "Gagal ambil tarif" });
    }

    const best = {};
    for (const c of (rateData.pricing || [])) {
      if (!best[c.courier_code] || c.price < best[c.courier_code].price) {
        best[c.courier_code] = { price: c.price, service: c.courier_service_name };
      }
    }

    res.json({ success: true, destination: areaData.areas[0].name, rates: best });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/tools/rab
app.post("/api/tools/rab", (req, res) => {
  const { kode, volume } = req.body;
  if (!kode) return res.status(400).json({ error: "kode AHSP diperlukan" });
  try {
    const RAB_DIR = "/root/ai-system/skills/ternion-rab";
    const loadJson = (name) => {
      const p = `${RAB_DIR}/${name}`;
      return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : {};
    };
    const ahsp_umum = loadJson("ahsp_umum_ck.json");
    const ahsp_bm = loadJson("ahsp_bm_sda.json");
    const hsd_upah = loadJson("hsd_upah.json");
    const hsd_bahan = loadJson("hsd_bahan.json");
    const hsd_alat = loadJson("hsd_alat.json");

    const all_ahsp = { ...ahsp_umum, ...ahsp_bm };
    const item = all_ahsp[kode];

    if (!item) {
      return res.json({ error: "Kode AHSP tidak ditemukan: " + kode });
    }

    let total_tenaga = 0, total_bahan = 0, total_alat = 0;
    const detail = { tenaga: [], bahan: [], alat: [] };

    for (const t of (item.tenaga || [])) {
      const hsd = hsd_upah[t.kode]?.harga || 0;
      const nilai = t.koef * hsd;
      total_tenaga += nilai;
      detail.tenaga.push({ ...t, harga: hsd, nilai });
    }
    for (const b of (item.bahan || [])) {
      const hsd = hsd_bahan[b.kode]?.harga || 0;
      const nilai = b.koef * hsd;
      total_bahan += nilai;
      detail.bahan.push({ ...b, harga: hsd, nilai });
    }
    for (const a of (item.alat || [])) {
      const hsd = hsd_alat[a.kode]?.harga || 0;
      const nilai = a.koef * hsd;
      total_alat += nilai;
      detail.alat.push({ ...a, harga: hsd, nilai });
    }

    const D = total_tenaga + total_bahan + total_alat;
    const E = D * 0.10;
    const HSP = D + E;
    const jumlah = HSP * (volume || 1);

    res.json({ kode, nama: item.nama, satuan: item.satuan, detail, D, E, HSP, volume: volume || 1, jumlah });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/status
app.get("/api/status", (req, res) => {
  const { execSync } = require("child_process");
  try {
    const pm2_raw = execSync("pm2 jlist", { encoding: "utf8" });
    const pm2_list = JSON.parse(pm2_raw);
    const proses = pm2_list.map(p => ({
      name: p.name,
      status: p.pm2_env.status,
      restart: p.pm2_env.restart_time,
      uptime: p.pm2_env.pm_uptime
    }));
    res.json({ timestamp: new Date().toISOString(), proses, memory: process.memoryUsage() });
  } catch (e) {
    res.json({ error: e.message });
  }
});

// ── START SERVER
const PORT = process.env.GATEWAY_PORT || 3001;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`[GATEWAY] TERNION API Gateway running on port ${PORT}`);
  console.log(`[GATEWAY] URL: http://212.85.27.198:${PORT}/api`);
});

process.on("uncaughtException", (err) => console.error("[GATEWAY] Error:", err.message));
process.on("unhandledRejection", (r) => console.error("[GATEWAY] Rejected:", r instanceof Error ? r.message : r));

module.exports = app;
