require("dotenv").config();

const { execFile } = require("child_process");
const { promisify } = require("util");
const axios = require("axios");
const fs = require("fs-extra");

const execFileAsync = promisify(execFile);

const RECOVERY_LOG = "/root/ai-system/memory/recovery-log.json";
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || "8615852356:AAGzjiONLbkuSKBvXePPwhuKACkCZMC0QaY";
const CHAT_ID = 6935073123;
const CHECK_INTERVAL = 10 * 60 * 1000; // 10 menit

const CRITICAL_PROCESSES = ["telegram", "worker", "heartbeat"];

async function sendAlert(message) {
  try {
    await axios.post(
      `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`,
      { chat_id: CHAT_ID, text: message, parse_mode: "HTML" },
      { timeout: 15000 }
    );
  } catch (err) {
    console.error("[AUTO-RECOVERY] Gagal kirim alert:", err.message);
  }
}

async function logRecovery(entry) {
  try {
    await fs.ensureFile(RECOVERY_LOG);
    let log = [];
    try { log = await fs.readJson(RECOVERY_LOG); } catch { log = []; }
    if (!Array.isArray(log)) log = [];
    log.push(entry);
    if (log.length > 200) log = log.slice(-200);
    await fs.writeJson(RECOVERY_LOG, log, { spaces: 2 });
  } catch (err) {
    console.error("[AUTO-RECOVERY] Gagal log:", err.message);
  }
}

async function checkAndRecover() {
  let procs = [];
  try {
    const { stdout } = await execFileAsync("pm2", ["jlist"], { timeout: 15000 });
    procs = JSON.parse(stdout);
  } catch (err) {
    console.error("[AUTO-RECOVERY] Tidak bisa baca PM2:", err.message);
    return;
  }

  for (const proc of procs) {
    if (!CRITICAL_PROCESSES.includes(proc.name)) continue;
    const status = proc.pm2_env.status;
    // "stopping" dan "launching" adalah status transisi saat restart manual — skip
    if (status === "online" || status === "stopping" || status === "launching") continue;
    if (status !== "online") {
      const now = new Date().toISOString();
      console.log(`[AUTO-RECOVERY] ${proc.name} DOWN (${status}) — restart`);

      try {
        await execFileAsync("pm2", ["restart", proc.name], { timeout: 30000 });
        const entry = { timestamp: now, process: proc.name, action: "restarted", prev_status: proc.pm2_env.status };
        await logRecovery(entry);
        await sendAlert(`⚠️ <b>AUTO-RECOVERY</b>\n\nProses <b>${proc.name}</b> crash (${proc.pm2_env.status})\n✅ Berhasil di-restart\n⏰ ${now}`);
      } catch (err) {
        await logRecovery({ timestamp: now, process: proc.name, action: "restart_failed", error: err.message });
        await sendAlert(`🚨 <b>CRITICAL</b>\n\nGagal restart <b>${proc.name}</b>!\nError: ${err.message}\n⏰ ${now}`);
      }
    }
  }

  // Cek RAM
  try {
    const meminfo = require("fs").readFileSync("/proc/meminfo", "utf8");
    const total = parseInt(meminfo.match(/MemTotal:\s+(\d+)/)[1]);
    const avail = parseInt(meminfo.match(/MemAvailable:\s+(\d+)/)[1]);
    const pct = Math.round(((total - avail) / total) * 100);
    if (pct > 80) {
      await sendAlert(`⚠️ <b>RAM TINGGI</b>\n\nPenggunaan RAM: <b>${pct}%</b>\n💾 Avail: ${(avail / 1e6).toFixed(0)} MB\n⏰ ${new Date().toISOString()}`);
    }
  } catch {}

  // Cek Google token expiry
  checkGoogleToken().catch(() => {});
}

// Cek health Google Drive dengan test upload kecil
// (access_token auto-refresh via googleapis, jadi yang perlu dicek adalah refresh_token)
let driveAlertSent = null;
async function checkGoogleToken() {
  const today = new Date().toISOString().split("T")[0];
  if (driveAlertSent === today) return;

  try {
    const tokenData = JSON.parse(require("fs").readFileSync("/root/ai-system/tokens/google-token.json", "utf8"));
    if (!tokenData.refresh_token) {
      driveAlertSent = today;
      await sendAlert(`🚨 <b>GOOGLE REFRESH TOKEN HILANG</b>\n\nPerlu re-autentikasi Google Drive!\n⚡ Ketik <code>/reauth-google</code> untuk instruksi\n⏰ ${new Date().toISOString()}`);
      return;
    }
    // Coba test upload untuk verifikasi Drive masih bisa dipakai
    const { uploadFile } = require("./integrations/drive-backup");
    const tmpFile = "/tmp/ternion-health-check.json";
    require("fs").writeFileSync(tmpFile, JSON.stringify({ ts: new Date().toISOString() }));
    await uploadFile(tmpFile, "CORE-SYSTEM/health");
    console.log("[AUTO-RECOVERY] Google Drive: OK");
  } catch (err) {
    if (driveAlertSent !== today) {
      driveAlertSent = today;
      await sendAlert(`⚠️ <b>GOOGLE DRIVE ERROR</b>\n\nGagal akses Drive: ${err.message}\n\nJika terus terjadi, perlu re-auth Google.\n⏰ ${new Date().toISOString()}`);
    }
  }
}

console.log("[AUTO-RECOVERY] Berjalan — cek setiap 10 menit");

// Cek langsung saat start
checkAndRecover();

// Lalu setiap 10 menit
setInterval(checkAndRecover, CHECK_INTERVAL);

process.once("SIGINT", () => process.exit(0));
process.once("SIGTERM", () => process.exit(0));
