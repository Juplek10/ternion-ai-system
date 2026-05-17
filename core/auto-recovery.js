require("dotenv").config();

const { execFile } = require("child_process");
const { promisify } = require("util");
const fs = require("fs-extra");
const { startAutoRefresh } = require("./integrations/google");

const execFileAsync = promisify(execFile);

const RECOVERY_LOG = "/root/ai-system/memory/recovery-log.json";
const WA_QUEUE_PATH = "/root/ai-system/workspace/wa-queue.json";
const BRIAN_NOMOR = "6282266130808";
const CHECK_INTERVAL = 10 * 60 * 1000;

const CRITICAL_PROCESSES = ["worker", "heartbeat", "whatsapp", "api-gateway"];

async function sendAlert(message) {
  console.log("[AUTO-RECOVERY] ALERT:", message.replace(/<[^>]+>/g, ""));
  try {
    await fs.ensureFile(WA_QUEUE_PATH);
    let queue = { items: [] };
    try { queue = await fs.readJson(WA_QUEUE_PATH); } catch {}
    if (!Array.isArray(queue.items)) queue.items = [];
    queue.items.push({
      id: Date.now(),
      nomor: BRIAN_NOMOR,
      pesan: message.replace(/<[^>]+>/g, ""),
      timestamp: new Date().toISOString(),
      status: "pending"
    });
    await fs.writeJson(WA_QUEUE_PATH, queue, { spaces: 2 });
  } catch (err) {
    console.error("[AUTO-RECOVERY] Gagal queue WA:", err.message);
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
    if (status === "online" || status === "stopping" || status === "launching") continue;
    if (status !== "online") {
      const now = new Date().toISOString();
      console.log(`[AUTO-RECOVERY] ${proc.name} DOWN (${status}) — restart`);

      try {
        await execFileAsync("pm2", ["restart", proc.name], { timeout: 30000 });
        const entry = { timestamp: now, process: proc.name, action: "restarted", prev_status: proc.pm2_env.status };
        await logRecovery(entry);
        await sendAlert(`⚠️ AUTO-RECOVERY\n\nProses ${proc.name} crash (${proc.pm2_env.status})\n✅ Berhasil di-restart\n⏰ ${now}`);
      } catch (err) {
        await logRecovery({ timestamp: now, process: proc.name, action: "restart_failed", error: err.message });
        await sendAlert(`🚨 CRITICAL\n\nGagal restart ${proc.name}!\nError: ${err.message}\n⏰ ${now}`);
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
      await sendAlert(`⚠️ RAM TINGGI\n\nPenggunaan RAM: ${pct}%\n💾 Avail: ${(avail / 1e6).toFixed(0)} MB\n⏰ ${new Date().toISOString()}`);
    }
  } catch {}

  checkGoogleToken().catch(() => {});
}

let driveAlertSent = null;
async function checkGoogleToken() {
  const today = new Date().toISOString().split("T")[0];
  if (driveAlertSent === today) return;

  try {
    const tokenData = JSON.parse(require("fs").readFileSync("/root/ai-system/tokens/google-token.json", "utf8"));
    if (!tokenData.refresh_token) {
      driveAlertSent = today;
      await sendAlert(`🚨 GOOGLE REFRESH TOKEN HILANG\n\nPerlu re-autentikasi Google Drive!\n⏰ ${new Date().toISOString()}`);
      return;
    }
    const { uploadFile } = require("./integrations/drive-backup");
    const tmpFile = "/tmp/ternion-health-check.json";
    require("fs").writeFileSync(tmpFile, JSON.stringify({ ts: new Date().toISOString() }));
    await uploadFile(tmpFile, "CORE-SYSTEM/health");
    console.log("[AUTO-RECOVERY] Google Drive: OK");
  } catch (err) {
    if (driveAlertSent !== today) {
      driveAlertSent = today;
      await sendAlert(`⚠️ GOOGLE DRIVE ERROR\n\nGagal akses Drive: ${err.message}\n⏰ ${new Date().toISOString()}`);
    }
  }
}

startAutoRefresh();

console.log("[AUTO-RECOVERY] Berjalan — cek setiap 10 menit");

checkAndRecover();
setInterval(checkAndRecover, CHECK_INTERVAL);

process.once("SIGINT", () => process.exit(0));
process.once("SIGTERM", () => process.exit(0));
