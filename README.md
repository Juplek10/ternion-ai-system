# TERNION-AI — Second Brain System

**AI pribadi Brian Kinayom / TERNION GROUP, Kupang NTT**

Sistem AI terdistribusi berbasis Ollama (lokal) + Claude CLI (cloud), dengan memory persisten, backup Google Drive real-time, notifikasi proaktif, web search, dan monitoring LPSE.

---

## Arsitektur Sistem

```
telegram.js (entry point Telegram bot)
    │
    ├── core/router/router.js          ← Smart 3-layer routing
    │       ├── claude-pipe.js         ← Primary AI (Claude CLI)
    │       └── ollama.js              ← Fallback / Heavy tasks
    │
    ├── core/memory/long-term-memory.js ← Persistent memory + domain split
    │       ├── memory/personal.json
    │       ├── memory/bisnis.json
    │       ├── memory/proyek.json
    │       ├── memory/kontak.json
    │       ├── memory/keputusan.json
    │       └── memory/percakapan.json
    │
    ├── core/tools/                    ← Domain tools
    │       ├── ahs-tool.js            ← Analisa Harga Satuan
    │       ├── rab-tool.js            ← RAB Generator
    │       ├── draft-tool.js          ← Draft dokumen
    │       ├── price-check-tool.js    ← Cek harga komoditas
    │       ├── web-search-tool.js     ← Web search (Tavily/DDG)
    │       └── lpse-monitor.js        ← Monitor tender LPSE NTT
    │
    ├── core/agents/                   ← Specialist agents (pakai ternion-ai 7b)
    │       ├── construction-agent.js
    │       ├── strategy-agent.js
    │       ├── trading-agent.js
    │       ├── procurement-agent.js
    │       └── admin-agent.js
    │
    ├── core/registry/                 ← Data registry
    │       ├── contact-registry.js
    │       └── project-registry.js
    │
    ├── core/proactive/
    │       └── notification-engine.js ← Morning brief + weekly report
    │
    ├── core/dreaming/
    │       └── dream-engine.js        ← Nightly AI review + soul update
    │
    ├── core/integrations/
    │       ├── drive.js               ← Google Drive API
    │       └── drive-backup.js        ← Real-time memory backup ke Drive
    │
    ├── core/health-check.js           ← HTTP health endpoint (port 3001)
    └── core/auto-recovery.js          ← Auto-restart proses crash
```

---

## Model AI

| Task | Model | Keterangan |
|------|-------|-----------|
| Chat biasa | Claude (PRIMARY_AI=claude) | Smart, contextual |
| Chat fallback | qwen2.5:3b | Jika Claude gagal |
| /ahs /rab /konstruksi /strategi /analisa /trading /procurement | ternion-ai (7b) | Heavy structured output |
| Heartbeat / memory | qwen2.5:3b | Cepat, ringan |

---

## Command Telegram

### Tools
| Command | Fungsi |
|---------|--------|
| `/ahs [pekerjaan]` | Analisa Harga Satuan konstruksi |
| `/rab [proyek]` | Generate RAB lengkap |
| `/draft [dokumen]` | Buat draft dokumen/surat |
| `/harga [komoditas]` | Cek harga + web search real-time |
| `/cari [topik]` | Web search langsung |
| `/berita [topik]` | Search berita terbaru |

### Agents (pakai model 7b)
| Command | Fungsi |
|---------|--------|
| `/procurement [query]` | Tender & pengadaan |
| `/trading [topik]` | Komoditas & ekspor |
| `/konstruksi [query]` | Teknis konstruksi |
| `/strategi [situasi]` | Strategi bisnis |
| `/admin [kebutuhan]` | Dokumen & administrasi |

### Skills
| Command | Fungsi |
|---------|--------|
| `/rangkum [teks]` | Rangkum teks |
| `/terjemah [bahasa] [teks]` | Terjemahan |
| `/analisa [data]` | Analisa strategis |
| `/ingatkan [menit] [pesan]` | Set reminder |

### Memory
| Command | Fungsi |
|---------|--------|
| `/memory` | Ringkasan memory per domain |
| `/ingat [fakta]` | Simpan fakta baru |
| `/lupa [topik]` | Hapus memory |

### Registry
| Command | Fungsi |
|---------|--------|
| `/kontak tambah [nama] [perusahaan] [telp] [catatan]` | Tambah kontak |
| `/kontak cari [nama]` | Cari kontak |
| `/kontak list` | Lihat semua kontak |
| `/proyek tambah [nama] [nilai] [deadline] [status]` | Tambah proyek |
| `/proyek update [nama] [status]` | Update status proyek |
| `/proyek list` | Lihat semua proyek aktif |
| `/proyek [nama]` | Detail proyek |

### Sistem
| Command | Fungsi |
|---------|--------|
| `/status` | Status sistem (RAM, model, soul) |
| `/drive` | File di Google Drive |
| `/help` | Tampilkan menu lengkap |

---

## PM2 Processes

| Name | Script | Fungsi |
|------|--------|--------|
| telegram | telegram.js | Bot Telegram utama |
| worker | worker.js | Background worker |
| heartbeat | heartbeat.js | Pulse check AI |
| background-worker | background-worker.js | Task async |
| monitor-loop | monitor-loop.js | System monitoring |
| drive-watcher | core/integrations/drive-watcher.js | Watch Drive |
| dream-engine | core/dreaming/dream-engine.js | Nightly AI review |
| backup-scheduler | backup-scheduler.js | Backup scheduler |
| health-check | core/health-check.js | HTTP health endpoint |
| auto-recovery | core/auto-recovery.js | Auto-restart crash |
| notification-engine | core/proactive/notification-engine.js | Morning brief |
| lpse-monitor | core/tools/lpse-monitor.js | Monitor LPSE NTT |

---

## Setup dari Awal

```bash
# 1. Clone repo
git clone https://github.com/Juplek10/ternion-ai-system.git /root/ai-system
cd /root/ai-system

# 2. Install dependencies
npm install

# 3. Setup Ollama
curl -fsSL https://ollama.com/install.sh | sh
ollama pull qwen2.5:3b
ollama create ternion-ai -f prompts/Modelfile

# 4. Setup .env
cp .env.example .env
# Edit: OLLAMA_BASE_URL, PRIMARY_AI, TAVILY_API_KEY

# 5. Setup Google Drive
# Jalankan: node core/integrations/google-auth.js
# Ikuti instruksi OAuth

# 6. Start semua proses
pm2 start ecosystem.config.js
pm2 startup systemd -u root --hp /root
pm2 save
```

---

## Cara Restore dari Backup

```bash
# Memory ada di Google Drive: CORE-SYSTEM/memory/
# Download manual atau via Drive API

# Restore memory lokal:
cp /backup/memory/*.json /root/ai-system/memory/

# Restart bot
pm2 restart all
```

---

## Troubleshooting

| Masalah | Solusi |
|---------|--------|
| Bot tidak merespons | `pm2 logs telegram` — cek error |
| Ollama timeout | `ollama list` — model aktif? |
| Google Drive error | Token expired → jalankan ulang OAuth |
| RAM tinggi | `pm2 restart heartbeat dream-engine` |
| Claude timeout | Bot auto-fallback ke qwen2.5:3b |

---

## Upgrade VPS & Switch ke Ollama Full

Saat RAM VPS sudah ≥ 16GB:

```bash
# 1. Ganti .env
PRIMARY_AI=ollama

# 2. Pull model yang lebih besar (opsional)
ollama pull llama3.1:8b

# 3. Restart
pm2 restart telegram
```

---

## Health Check

```bash
curl http://127.0.0.1:3001/health
```

---

*TERNION-AI v3.0 — Built for Brian Kinayom, TERNION GROUP, Kupang NTT*
