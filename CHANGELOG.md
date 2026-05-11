# CHANGELOG — TERNION-AI

---

## [3.1.0] — 2026-05-11

### Ditambahkan
- **TELEGRAM_TOKEN** ditambah ke `.env` sebagai alias `TELEGRAM_BOT_TOKEN` agar konsisten dengan semua modul
- **Help command diperbarui**: Menampilkan semua command lengkap termasuk `/cari`, `/berita`, `/kontak`, `/proyek`, dan auto web search trigger
- **PM2 auto-start**: Service `pm2-root.service` enabled di systemd, `pm2 save` berhasil — semua 12 proses tersimpan

### Diubah
- `/help`: Menampilkan 6 section (Tools, Web Search, Agents, Skills, Registry, Memory, Sistem) secara lengkap

---

## [3.0.0] — 2026-05-11

### Ditambahkan
- **Claude Pipe** (`core/providers/claude-pipe.js`): Primary AI via Claude CLI, inject soul + memory terbaru, timeout 60s, fallback ke qwen2.5:3b
- **PRIMARY_AI config**: `.env` variable `PRIMARY_AI=claude` — tinggal ganti ke `ollama` saat upgrade VPS
- **Domain Memory**: Memory dipecah per domain (personal, bisnis, proyek, kontak, keputusan, percakapan)
- **Drive Backup Real-time** (`core/integrations/drive-backup.js`): Setiap `addFact()` auto-backup async ke Google Drive `CORE-SYSTEM/memory/`
- **Health Check** (`core/health-check.js`): HTTP server port 3001, endpoint `/health` dengan status semua proses PM2
- **Auto Recovery** (`core/auto-recovery.js`): Cek setiap 10 menit, restart proses crash, alert Telegram, cek RAM > 80%, alert token expired
- **Notification Engine** (`core/proactive/notification-engine.js`): Morning brief 06.00 WITA, weekly report Senin 07.00 WITA, alert RAM tinggi
- **Web Search** (`core/tools/web-search-tool.js`): Tavily API + DuckDuckGo fallback, auto-trigger dari kata kunci
- **LPSE Monitor** (`core/tools/lpse-monitor.js`): Scrape LPSE NTT setiap 6 jam, alert tender relevan
- **Contact Registry** (`core/registry/contact-registry.js`): `/kontak tambah|cari|list`
- **Project Registry** (`core/registry/project-registry.js`): `/proyek tambah|update|list|[nama]`
- **Command baru**: `/cari`, `/berita`, `/kontak`, `/proyek`
- **README.md**: Dokumentasi lengkap arsitektur, commands, setup, troubleshooting
- **CHANGELOG.md**: File ini

### Diubah
- `/memory` command: Tampilkan ringkasan per domain + timestamp last backup Drive
- `/harga` command: Sekarang inject web search ke konteks AI
- `long-term-memory.js`: Rewrite dengan domain detection, domain files, Drive backup
- `router.js`: Baca `PRIMARY_AI` dari env, route ke Claude atau Ollama
- Chat fallback: Auto web search jika pesan mengandung keyword tertentu
- **PM2 auto-start**: `pm2 startup systemd` + `pm2 save`

---

## [2.1.0] — 2026-05-11

### Diubah
- **Smart 3-layer router**: `classifyTask()` di `router.js`
- `/ahs`, `/rab` → eksplisit pakai `ternion-ai` (7b)
- `/analisa` → eksplisit pakai `ternion-ai` (7b)
- `askOllama(prompt, model)` → model jadi parameter opsional, default `qwen2.5:3b`
- `base-agent.js` → model parameter opsional, default `ternion-ai`
- `classifyCommand()` di `telegram.js`

---

## [2.0.0] — 2026-05-11

### Ditambahkan
- Soul identity `ternion-soul.txt` — injected ke semua model
- Heartbeat system
- Dream engine (nightly review 03.00 WITA, kirim report 06.00 WITA)
- Long-term memory + auto-extract dari percakapan
- File memory (upload/download dokumen)
- Session history management
- Tools: AHS, RAB, draft, price-check
- Agents: procurement, trading, konstruksi, strategi, admin
- Skills: rangkum, terjemah, analisa, reminder
- Google Drive integration
- Backup scheduler
- Background worker
- Monitor loop

---

## [1.0.0] — Initial Build

- Bot Telegram dasar
- Ollama integration (qwen2.5:3b)
- Basic command handling
