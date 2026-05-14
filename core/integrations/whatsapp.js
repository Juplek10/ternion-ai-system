require("dotenv").config();

const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");
const qrcode = require("qrcode");
const qrcodeTerminal = require("qrcode-terminal");
const fs = require("fs-extra");
const path = require("path");
const axios = require("axios");

const askClaude = require("../providers/claude-pipe");

// ─── Contact Intelligence Modules ────────────────────────
const { getContactOrDefault, addContact, updateInteraction } = require("../contacts/contact-manager");
const { checkAndFilter } = require("../contacts/info-firewall");
const { detectApprovalNeeded, createApproval, resolveApproval, getApproval,
        listPendingApprovals, getApprovalPendingResponse, getApproveResponse,
        getRejectResponse, getTundaResponse } = require("../contacts/approval-workflow");
const { detectFlowTrigger, processStep, startFlow, generateFromFlow, loadState, clearState } = require("../contacts/conversation-flow");
const { routeAndDelegate, setupDelegasi } = require("../contacts/delegation-engine");
const { detectFollowUpTrigger, setFollowUp, listFollowUps, cancelFollowUp,
        completeFollowUp, startFollowUpLoop } = require("../contacts/follow-up-engine");
const { getSystemPrompt, getSalutation } = require("../contacts/language-style");
const { isNexus, isActive, isDarurat, deactivateAI, activateAI, pauseAI,
        getStatus, handleNexusSwitch, notifyBrianIncomingWhenOff,
        KEYWORDS_OFF, KEYWORDS_ON } = require("../contacts/master-switch");

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || "8615852356:AAGzjiONLbkuSKBvXePPwhuKACkCZMC0QaY";
const BRIAN_CHAT_ID = 6935073123;
const UPLOADS_DIR = "/root/ai-system/workspace/uploads";
const SESSION_DIR = "/root/ai-system/.wwebjs_auth";

const OWNER_WA = "6282266130808@c.us";

const pendingApprovals = new Map();
const APPROVAL_TIMEOUT_MS = 10 * 60 * 1000;

// ─── Helpers ──────────────────────────────────────────────
function genId() {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}

function timeNow() {
  return new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Makassar" });
}

async function notifyTelegram(text) {
  try {
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: BRIAN_CHAT_ID,
      text,
      parse_mode: "HTML"
    });
  } catch (err) {
    console.error("[WA→TG] Gagal kirim:", err.message);
  }
}

async function sendQRToTelegram(qrString) {
  try {
    const qrBuffer = await qrcode.toBuffer(qrString, { type: "png", width: 400, margin: 2 });
    const FormData = require("form-data");
    const form = new FormData();
    form.append("chat_id", BRIAN_CHAT_ID);
    form.append("photo", qrBuffer, { filename: "whatsapp-qr.png", contentType: "image/png" });
    form.append("caption", "📱 Scan QR ini untuk menghubungkan WhatsApp ke TERNION-AI\n\nBuka WhatsApp → Perangkat Tertaut → Scan QR ini");
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendPhoto`, form, { headers: form.getHeaders() });
    console.log("[WA] QR dikirim ke Telegram");
  } catch (err) {
    qrcodeTerminal.generate(qrString, { small: true });
  }
}

async function notifyOwner(text) {
  // Notifikasi sistem dialihkan ke Telegram. WA 6282266130808 tidak menerima forward/notif dari sistem.
  try {
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: BRIAN_CHAT_ID,
      text,
      parse_mode: "Markdown"
    });
  } catch (err) {
    console.error("[WA→TG] Gagal notif owner via Telegram:", err.message);
  }
}

function react(msg, emoji) {
  msg.react(emoji).catch(() => {});
}

// ─── Grup Handler ─────────────────────────────────────────
function isGrup(msg) {
  return msg.from.endsWith("@g.us");
}

function shouldRespondInGroup(body) {
  const lower = body.toLowerCase();
  return (
    lower.includes("ternion ai") ||
    lower.includes("@ternion") ||
    (lower.includes("?") && (lower.includes("ai") || lower.includes("bot"))) ||
    lower.includes("darurat") ||
    lower.includes("urgent") ||
    lower.includes("tolong ai")
  );
}

// ─── Detect grup name registry ────────────────────────────
const GRUP_REGISTRY_FILE = "/root/ai-system/memory/contacts/grup-registry.json";

async function loadGrupRegistry() {
  try {
    await fs.ensureFile(GRUP_REGISTRY_FILE);
    return await fs.readJson(GRUP_REGISTRY_FILE).catch(() => ({ groups: {} }));
  } catch {
    return { groups: {} };
  }
}

async function saveGrupRegistry(data) {
  await fs.ensureFile(GRUP_REGISTRY_FILE);
  await fs.writeJson(GRUP_REGISTRY_FILE, data, { spaces: 2 });
}

async function registerGroup(groupId, nama, fungsi) {
  const data = await loadGrupRegistry();
  data.groups[groupId] = { id: groupId, nama, fungsi, registered_at: new Date().toISOString(), msg_count_today: 0, last_reset: new Date().toISOString().split("T")[0] };
  await saveGrupRegistry(data);
}

async function trackGroupMessage(groupId, senderName, body) {
  try {
    const data = await loadGrupRegistry();
    if (!data.groups[groupId]) return;
    const today = new Date().toISOString().split("T")[0];
    const grp = data.groups[groupId];
    if (grp.last_reset !== today) {
      grp.msg_count_today = 0;
      grp.last_reset = today;
      grp.senders_today = {};
      grp.topics_today = [];
    }
    grp.msg_count_today = (grp.msg_count_today || 0) + 1;
    grp.senders_today = grp.senders_today || {};
    grp.senders_today[senderName] = (grp.senders_today[senderName] || 0) + 1;
    await saveGrupRegistry(data);
  } catch {}
}

// ─── Command routing ──────────────────────────────────────
async function routeCommand(cmd, query, msg) {
  const cmdLower = cmd.toLowerCase();
  try {
    if (cmdLower === "/ahs") {
      if (!query) return "Format: /ahs [deskripsi pekerjaan]";
      const { runAHS } = require("../tools/ahs-tool");
      return await runAHS(query);
    }
    if (cmdLower === "/rab") {
      if (!query) return "Format: /rab [nama proyek]";
      const { runRAB } = require("../tools/rab-tool");
      return await runRAB(query);
    }
    if (cmdLower === "/draft") {
      if (!query) return "Format: /draft [jenis dokumen + detail]";
      const { runDraft } = require("../tools/draft-tool");
      return await runDraft(query);
    }
    if (cmdLower === "/harga") {
      if (!query) return "Format: /harga [nama komoditas]";
      const { runPriceCheck } = require("../tools/price-check-tool");
      let webCtx = "";
      try { const { searchWeb } = require("../tools/web-search-tool"); webCtx = await searchWeb(`harga ${query} terbaru 2026`); } catch {}
      return await runPriceCheck(query + (webCtx ? `\n\nData web:\n${webCtx}` : ""));
    }
    if (cmdLower === "/cari" || cmdLower === "/berita") {
      if (!query) return "Format: /cari [topik]";
      const { searchWeb } = require("../tools/web-search-tool");
      return await searchWeb(query);
    }
    if (cmdLower === "/konstruksi") {
      const { runConstructionAgent } = require("../agents/construction-agent");
      return await runConstructionAgent(query);
    }
    if (cmdLower === "/trading") {
      const { runTradingAgent } = require("../agents/trading-agent");
      return await runTradingAgent(query);
    }
    if (cmdLower === "/procurement") {
      const { runProcurementAgent } = require("../agents/procurement-agent");
      return await runProcurementAgent(query);
    }
    if (cmdLower === "/strategi") {
      const { runStrategyAgent } = require("../agents/strategy-agent");
      return await runStrategyAgent(query);
    }
    if (cmdLower === "/admin") {
      const { runAdminAgent } = require("../agents/admin-agent");
      return await runAdminAgent(query);
    }
    if (cmdLower === "/analisa") {
      const { analyze } = require("../skills/analyze-skill");
      return await analyze(query);
    }
    if (cmdLower === "/rangkum") {
      const { summarize } = require("../skills/summarize-skill");
      return await summarize(query);
    }
    if (cmdLower === "/terjemah") {
      const parts = query.split(/\s+/);
      const { translate } = require("../skills/translate-skill");
      return await translate(parts[0], parts.slice(1).join(" "));
    }
    if (cmdLower === "/help") {
      return `📋 *Command TERNION-AI:*\n\n/ahs /rab /draft /harga /cari\n/konstruksi /trading /procurement\n/strategi /admin /analisa\n/wa-list /wa-info /wa-add\n/followup list\n/ai-status\n\nAtau chat biasa!`;
    }
    // Dynamic skills
    const skillCmd = cmdLower.replace("/", "");
    const { runDynamicSkill } = require("../evolution/skill-builder");
    const result = await runDynamicSkill(skillCmd, query);
    if (result !== null) return result;
    return null;
  } catch (err) {
    console.error(`[WA] Error command ${cmd}:`, err.message);
    return `❌ Error: ${err.message}`;
  }
}

// ─── NEXUS Command Handler (khusus Brian dari WA) ─────────
async function handleNexusCommand(body, sender) {
  const lower = body.toLowerCase().trim();

  // Master switch
  const switchResult = await handleNexusSwitch(body);
  if (switchResult) return switchResult;

  // Contact management
  if (lower.startsWith("/wa-add ")) {
    const parts = body.split(/\s+/);
    if (parts.length < 4) return "Format: /wa-add [nomor] [kategori] [nama...]";
    const [, nomor, kategori, ...namaArr] = parts;
    const nama = namaArr.join(" ");
    await addContact(nomor, { kategori, nama });
    return `✅ Kontak ditambahkan:\n📞 ${nomor}\n🏷️ ${kategori}\n👤 ${nama}`;
  }

  if (lower === "/wa-list") {
    const { listContacts, formatContactInfo } = require("../contacts/contact-manager");
    const list = await listContacts();
    const valid = list.filter(c => !c.nomor.includes("XXXXXXX") && !c.nomor.startsWith("_"));
    if (valid.length === 0) return "Belum ada kontak terdaftar.\nGunakan /wa-add untuk menambah.";
    return valid.map((c, i) => `${i + 1}. ${c.nama || c.nomor} — ${c.kategori} (${c.nomor})`).join("\n");
  }

  if (lower.startsWith("/wa-info ")) {
    const nomor = body.split(/\s+/)[1];
    const { getContact, formatContactInfo } = require("../contacts/contact-manager");
    const kontak = await getContact(nomor);
    if (!kontak) return `❌ Kontak ${nomor} tidak ditemukan.`;
    return formatContactInfo(kontak);
  }

  if (lower.startsWith("/wa-remove ")) {
    const nomor = body.split(/\s+/)[1];
    const { removeContact } = require("../contacts/contact-manager");
    const ok = await removeContact(nomor);
    return ok ? `✅ Kontak ${nomor} dihapus.` : `❌ Kontak tidak ditemukan.`;
  }

  if (lower.startsWith("/wa-edit ")) {
    const parts = body.split(/\s+/);
    if (parts.length < 4) return "Format: /wa-edit [nomor] [field] [nilai...]\nField: nama, panggilan, kategori, gaya_bicara, konteks_bisnis, trust_level";
    const nomor = parts[1];
    const field = parts[2].toLowerCase();
    const nilai = parts.slice(3).join(" ");
    const allowedFields = ["nama", "panggilan", "kategori", "gaya_bicara", "konteks_bisnis", "trust_level", "sub_kategori", "bahasa"];
    if (!allowedFields.includes(field)) return `❌ Field '${field}' tidak diizinkan.\nField valid: ${allowedFields.join(", ")}`;
    const { updateContact } = require("../contacts/contact-manager");
    const updated = await updateContact(nomor, { [field]: nilai });
    if (!updated) return `❌ Kontak ${nomor} tidak ditemukan.`;
    return `✅ Kontak ${nomor} diupdate:\n${field} = ${nilai}`;
  }

  if (lower.startsWith("/wa-grup ")) {
    const parts = body.split(/\s+/);
    const subCmd = parts[1]?.toLowerCase();
    if (subCmd === "daftar" || subCmd === "tambah") {
      if (parts.length < 4) return "Format: /wa-grup daftar [groupId] [nama] [fungsi]";
      const groupId = parts[2];
      const nama = parts[3];
      const fungsi = parts.slice(4).join(" ") || "umum";
      await registerGroup(groupId, nama, fungsi);
      return `✅ Grup terdaftar:\nID: ${groupId}\nNama: ${nama}\nFungsi: ${fungsi}`;
    }
    if (subCmd === "list") {
      const data = await loadGrupRegistry();
      const grups = Object.values(data.groups || {});
      if (grups.length === 0) return "Belum ada grup terdaftar.";
      return grups.map((g, i) => `${i + 1}. ${g.nama} (${g.id})\n   Fungsi: ${g.fungsi}`).join("\n");
    }
    return "Subcommand: /wa-grup daftar [id] [nama] [fungsi] | /wa-grup list";
  }

  if (lower.startsWith("/delegasi ")) {
    const parts = body.split(/\s+/);
    if (parts.length < 3) return "Format: /delegasi [nomor] [role: drafter/rab/scripta/vector]";
    await setupDelegasi(parts[1], parts[2]);
    return `✅ Nomor ${parts[1]} di-setup sebagai ${parts[2].toUpperCase()}.`;
  }

  if (lower === "/followup list" || lower === "/followup-list") {
    const list = await listFollowUps("pending");
    if (list.length === 0) return "✅ Tidak ada follow-up pending.";
    return list.map((f, i) => `${i + 1}. ${f.nama} — ${f.konteks.substring(0, 60)}\n   Deadline: ${f.deadline} | ID: ${f.id}`).join("\n");
  }

  if (lower.startsWith("/followup set ") || lower.startsWith("/followup-set ")) {
    const parts = body.split(/\s+/);
    const nomor = parts[2];
    const deadline = parts[3];
    const konteks = parts.slice(4).join(" ");
    if (!nomor || !deadline || !konteks) return "Format: /followup set [nomor] [YYYY-MM-DD] [konteks]";
    const fuId = await setFollowUp(nomor, nomor, konteks, deadline);
    return `✅ Follow-up set!\nNomor: ${nomor}\nDeadline: ${deadline}\nKonteks: ${konteks}\nID: ${fuId}`;
  }

  if (lower.startsWith("/followup-cancel ")) {
    const id = body.split(/\s+/)[1];
    const ok = await cancelFollowUp(id);
    return ok ? `✅ Follow-up ${id} dibatalkan.` : `❌ ID tidak ditemukan.`;
  }

  if (lower.startsWith("/followup-lanjut ")) {
    const id = body.split(/\s+/)[1];
    return `📋 Lanjut follow-up ${id} — kirim manual ke kontak terkait.`;
  }

  if (lower.startsWith("/approve ")) {
    const id = body.split(/\s+/)[1];
    const detail = body.split(/\s+/).slice(2).join(" ");
    const approval = await resolveApproval(id, "approved", null);
    if (!approval) return `❌ ID ${id} tidak ditemukan.`;
    try {
      await client.sendMessage(`${approval.nomor}@c.us`, getApproveResponse(detail));
    } catch {}
    return `✅ Approval ${id} dikirimkan ke ${approval.nama}.`;
  }

  if (lower.startsWith("/reject ")) {
    const parts = body.split(/\s+/);
    const id = parts[1];
    const alasan = parts.slice(2).join(" ");
    const approval = await resolveApproval(id, "rejected", alasan);
    if (!approval) return `❌ ID ${id} tidak ditemukan.`;
    try {
      await client.sendMessage(`${approval.nomor}@c.us`, getRejectResponse(alasan));
    } catch {}
    return `✅ Reject ${id} terkirim ke ${approval.nama}.`;
  }

  if (lower.startsWith("/tunda ")) {
    const id = body.split(/\s+/)[1];
    const approval = await resolveApproval(id, "tunda", null);
    if (!approval) return `❌ ID ${id} tidak ditemukan.`;
    try {
      await client.sendMessage(`${approval.nomor}@c.us`, getTundaResponse());
    } catch {}
    return `✅ Tunda ${id} — sudah dibalas ke ${approval.nama}.`;
  }

  if (lower === "/ai-status") {
    return await getStatus();
  }

  if (lower === "/wa-setup") {
    return (
      `📋 *PANDUAN SETUP KONTAK TERNION-AI*\n\n` +
      `━━ KONTAK ━━\n` +
      `/wa-add [nomor] [kategori] [nama]\n` +
      `/wa-edit [nomor] [field] [nilai]\n` +
      `/wa-info [nomor]\n` +
      `/wa-list\n` +
      `/wa-remove [nomor]\n\n` +
      `Kategori: nexus | internal | kontraktor\nsupplier | pengepul | relasi | pemerintah\n\n` +
      `━━ DELEGASI TIM ━━\n` +
      `/delegasi [nomor] [drafter/rab/scripta/vector]\n\n` +
      `━━ GRUP ━━\n` +
      `/wa-grup daftar [groupId] [nama] [fungsi]\n` +
      `/wa-grup list\n\n` +
      `━━ FOLLOW-UP ━━\n` +
      `/followup list\n` +
      `/followup set [nomor] [YYYY-MM-DD] [konteks]\n` +
      `/followup-cancel [ID]\n\n` +
      `━━ AI SWITCH ━━\n` +
      `stop ai | aktif | pause 30 menit\n` +
      `status ai\n\n` +
      `Contoh:\n/wa-add 628111xxx kontraktor Pak Ahmad\n/delegasi 628222xxx drafter`
    );
  }

  return null;
}

// ─── Handler pesan dari OWNER ─────────────────────────────
async function handleOwnerMessage(msg) {
  const body = (msg.body || "").trim();
  console.log(`[WA] Pesan dari NEXUS: ${body.substring(0, 80)}`);

  // Cek NEXUS command dulu
  const nexusResult = await handleNexusCommand(body, OWNER_WA);
  if (nexusResult) {
    await msg.reply(nexusResult);
    return;
  }

  // Cek pola #ID untuk konfirmasi
  const idMatch = body.match(/#([A-Z0-9]{4,})\s*$/i);
  if (idMatch) {
    const id = idMatch[1].toUpperCase();
    const pending = pendingApprovals.get(id);
    if (!pending) {
      await notifyOwner(`⚠️ Tidak ada pesan dengan ID *#${id}*.`);
      return;
    }
    clearTimeout(pending.timer);
    pendingApprovals.delete(id);
    const cmdPart = body.replace(/#[A-Z0-9]+\s*$/i, "").trim().toUpperCase();
    if (cmdPart === "SKIP") {
      await notifyOwner(`🚫 Pesan *#${id}* dari ${pending.senderName} diabaikan.`);
      react(pending.msg, "🚫");
      return;
    }
    const replyText = (cmdPart === "" || cmdPart === "KIRIM") ? pending.proposedReply : body.replace(/#[A-Z0-9]+\s*$/i, "").trim();
    try {
      await pending.msg.reply(replyText);
      react(pending.msg, "✅");
      await notifyOwner(`✅ Balasan *#${id}* terkirim ke *${pending.senderName}*.`);
      try {
        const { saveConversation } = require("../memory/long-term-memory");
        await saveConversation(`[WA dari ${pending.senderName}] ${pending.body}`, replyText).catch(() => {});
      } catch {}
    } catch (err) {
      await notifyOwner(`❌ Gagal kirim balasan #${id}: ${err.message}`);
    }
    return;
  }

  // Arahan umum
  await notifyOwner(`✅ Arahan diterima: "${body.substring(0, 100)}"`);
  try {
    const { saveConversation } = require("../memory/long-term-memory");
    await saveConversation(`[Arahan NEXUS via WA] ${body}`, "Dicatat.").catch(() => {});
  } catch {}
}

// ─── Handler pesan dari non-NEXUS ────────────────────────
async function handleIncomingMessage(msg) {
  const sender = msg.from;
  const body = msg.body || "";

  // Cek AI status
  const aiOn = await isActive();

  // Ambil info kontak
  const contact = await msg.getContact().catch(() => null);
  const senderName = contact?.pushname || contact?.name || sender.replace("@c.us", "");
  const kontak = await getContactOrDefault(sender);

  // Update interaksi
  await updateInteraction(sender, body);

  // Notif Brian jika kontak tidak dikenal (pertama kali)
  if (kontak.kategori === "tidak_dikenal" && kontak.total_interactions <= 1) {
    await notifyTelegram(
      `🔔 <b>KONTAK BARU (tidak terdaftar)</b>\n` +
      `👤 ${senderName} (${sender.replace("@c.us", "")})\n` +
      `💬 ${body.substring(0, 200)}\n\n` +
      `Tambah: /wa-add ${sender.replace("@c.us", "")} [kategori] ${senderName}`
    );
  }

  // AI nonaktif
  if (!aiOn) {
    await notifyBrianIncomingWhenOff(senderName, sender.replace("@c.us", ""), body);
    // Darurat tetap dibalas
    if (isDarurat(body)) {
      react(msg, "⚠️");
      await msg.reply("Saya terima pesannya. Sedang diteruskan ke Pak Brian sekarang. 🔴");
    }
    return;
  }

  // Handle media
  if (msg.hasMedia) {
    react(msg, "⏳");
    try {
      const media = await msg.downloadMedia();
      if (!media) return;
      await fs.ensureDir(UPLOADS_DIR);
      const ext = media.mimetype.split("/")[1]?.split(";")[0] || "bin";
      const filename = `wa_${Date.now()}_${senderName.replace(/\s+/g, "_")}.${ext}`;
      const localPath = path.join(UPLOADS_DIR, filename);
      await fs.writeFile(localPath, Buffer.from(media.data, "base64"));

      // Analisa foto jika gambar (hanya untuk NEXUS/owner)
      const isImage = media.mimetype.startsWith("image/");
      if (isImage && isNexus(sender)) {
        try {
          const { analyzeImage } = require("../tools/image-analyzer");
          const caption = body || "";
          const analisa = await analyzeImage(localPath, caption);
          // Hapus tag HTML untuk WhatsApp
          const analisaPlain = analisa.replace(/<[^>]+>/g, "").trim();
          await msg.reply(analisaPlain);
          react(msg, "✅");
        } catch (errAnalisa) {
          console.error("[WA-VISION] Error analisa:", errAnalisa.message);
          await msg.reply(`📸 Foto disimpan: ${filename}`);
          react(msg, "✅");
        }
        return;
      }

      try {
        const { uploadFile } = require("./drive-backup");
        await uploadFile(localPath, "UPLOADS");
      } catch {}
      await notifyOwner(`📎 *File dari ${senderName}*\nNama: ${filename}\n✅ Disimpan.`);
      react(msg, "✅");
    } catch (err) {
      await notifyOwner(`❌ Error handle file dari ${senderName}: ${err.message}`);
    }
    return;
  }

  if (!body.trim()) return;

  react(msg, "⏳");

  // ── NEXUS tidak perlu approval flow ──────────────────────
  // (sudah di-handle di handleOwnerMessage)

  // ── Check firewall dulu ────────────────────────────────
  const firewallResult = await checkAndFilter(body, kontak);
  if (firewallResult.blocked) {
    await msg.reply(firewallResult.response);
    react(msg, "🔒");
    return;
  }

  // ── Multi-step conversation flow ──────────────────────
  const existingState = await loadState(sender);
  if (existingState) {
    const stepResult = await processStep(sender, body);
    if (stepResult && !stepResult.done) {
      await msg.reply(stepResult.question);
      react(msg, "💬");
      return;
    }
    if (stepResult && stepResult.done) {
      react(msg, "⏳");
      const output = await generateFromFlow(stepResult);
      await sendWithApprovalCheck(msg, sender, senderName, body, kontak, output);
      return;
    }
  }

  // ── Detect flow trigger baru ───────────────────────────
  const flowTrigger = detectFlowTrigger(body);
  if (flowTrigger) {
    const firstQ = await startFlow(sender, flowTrigger);
    if (firstQ) {
      await msg.reply(firstQ);
      react(msg, "💬");
      return;
    }
  }

  // ── Command ────────────────────────────────────────────
  if (body.startsWith("/")) {
    const parts = body.trim().split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const query = parts.slice(1).join(" ");
    const result = await routeCommand(cmd, query, msg).catch(() => null);
    if (result !== null) {
      await sendWithApprovalCheck(msg, sender, senderName, body, kontak, result);
      return;
    }
  }

  // ── Check approval keyword ─────────────────────────────
  const approvalCheck = detectApprovalNeeded(body);
  if (approvalCheck.needed && kontak.kategori !== "nexus") {
    const approvalId = await createApproval(sender.replace("@c.us", ""), senderName, body, approvalCheck.reason);
    await msg.reply(getApprovalPendingResponse());
    react(msg, "⏳");
    return;
  }

  // ── Follow-up detection ────────────────────────────────
  const fuTrigger = detectFollowUpTrigger(body);
  if (fuTrigger) {
    await setFollowUp(sender, senderName, body, fuTrigger.estimated_deadline);
    console.log(`[WA] Follow-up set untuk ${senderName}: deadline ${fuTrigger.estimated_deadline}`);
  }

  // ── Delegation detection ───────────────────────────────
  const delegasiResult = await routeAndDelegate(sender, senderName, body);
  if (delegasiResult?.delegasi_ke) {
    try {
      await client.sendMessage(`${delegasiResult.delegasi_ke}@c.us`, delegasiResult.pesan_untuk_tim);
    } catch {}
  }

  // ── Generate AI reply dengan style ────────────────────
  try {
    const systemPrompt = getSystemPrompt(kontak);
    const salutation = getSalutation(kontak);

    const aiReply = await askClaude(
      `[Pesan WhatsApp dari ${senderName} — kategori: ${kontak.kategori}]\n\n${body}`,
      { systemContext: systemPrompt }
    );

    const finalReply = salutation && !aiReply.startsWith(salutation) ? aiReply : aiReply;

    // Cek perlu approval atau langsung kirim
    if (kontak.perlu_approval) {
      await sendWithApprovalCheck(msg, sender, senderName, body, kontak, finalReply);
    } else {
      await msg.reply(finalReply);
      react(msg, "✅");
    }

    // Simpan ke memory
    try {
      const { saveConversation } = require("../memory/long-term-memory");
      await saveConversation(`[WA dari ${senderName}] ${body}`, finalReply).catch(() => {});
    } catch {}

    // Auto-extract harga jika supplier/pengepul
    if ((kontak.kategori === "supplier" || kontak.kategori === "pengepul") && body.match(/\d+.*(?:juta|ribu|rb|k)\b/i)) {
      console.log(`[WA] Auto-extract harga dari ${senderName}: ${body.substring(0, 100)}`);
    }

  } catch (err) {
    console.error("[WA] Error generate reply:", err.message);
    react(msg, "❌");
    await notifyOwner(`❌ Gagal generate balasan untuk ${senderName}: ${err.message}`);
  }
}

// ─── Send dengan approval check untuk non-NEXUS ───────────
async function sendWithApprovalCheck(msg, sender, senderName, body, kontak, proposedReply) {
  if (!kontak.perlu_approval) {
    await msg.reply(proposedReply);
    react(msg, "✅");
    return;
  }

  const id = genId();
  await notifyOwner(
    `📨 *Pesan Masuk #${id}*\n` +
    `Dari: *${senderName}* (${sender.replace("@c.us", "")})\n` +
    `Kategori: ${kontak.kategori?.toUpperCase()}\n` +
    `Waktu: ${timeNow()}\n\n` +
    `💬 "${body.substring(0, 300)}"\n\n` +
    `🤖 Rencana balasan:\n"${(proposedReply || "").substring(0, 400)}"\n\n` +
    `━━━━━━━━━━━━\n` +
    `• *KIRIM #${id}* — Kirim balasan ini\n` +
    `• *SKIP #${id}* — Abaikan\n` +
    `• *[teks] #${id}* — Teks custom\n` +
    `⏰ Expired 10 menit`
  );

  const timer = setTimeout(async () => {
    if (pendingApprovals.has(id)) {
      pendingApprovals.delete(id);
      await notifyOwner(`⏰ Pesan *#${id}* dari ${senderName} expired.`);
      react(msg, "❌");
    }
  }, APPROVAL_TIMEOUT_MS);

  pendingApprovals.set(id, { msg, sender, senderName, body, proposedReply, timer });
}

// ─── Handler utama ─────────────────────────────────────────
async function handleMessage(msg) {
  if (msg.from === "status@broadcast" || msg.isStatus) return;
  if (msg.fromMe) return;

  const sender = msg.from;

  // Pesan dari NEXUS via WA
  if (sender === OWNER_WA) {
    await handleOwnerMessage(msg);
    return;
  }

  // Grup handling
  if (isGrup(msg)) {
    const body = msg.body || "";
    const contact = await msg.getContact().catch(() => null);
    const senderName = contact?.pushname || contact?.name || sender.replace("@c.us", "");
    await trackGroupMessage(msg.from, senderName, body).catch(() => {});
    if (!shouldRespondInGroup(body)) return;
    await handleIncomingMessage(msg);
    return;
  }

  // Pesan personal
  await handleIncomingMessage(msg);
}

// ─── WhatsApp Client ──────────────────────────────────────
const client = new Client({
  authStrategy: new LocalAuth({ dataPath: SESSION_DIR }),
  puppeteer: {
    headless: true,
    args: [
      "--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas", "--no-first-run", "--no-zygote",
      "--single-process", "--disable-gpu"
    ]
  },
  webVersion: "2.3000.1015901785-alpha",
  webVersionCache: {
    type: "remote",
    remotePath: "https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.3000.1015901785-alpha/index.html"
  }
});

client.on("qr", async (qr) => {
  console.log("[WA] QR diterima, mengirim ke Telegram...");
  await sendQRToTelegram(qr);
  await notifyTelegram("⏳ Scan QR untuk menghubungkan WhatsApp ke TERNION-AI.");
});

client.on("ready", async () => {
  console.log("[WA] WhatsApp terhubung!");
  try {
    const chats = await client.getChats();
    console.log(`[WA] OK — ${chats.length} chat`);
  } catch {}
  await notifyTelegram(
    "✅ <b>WhatsApp TERNION-AI Aktif!</b>\n" +
    "Contact Intelligence System: 🟢\n" +
    "Master Switch: 🟢\n" +
    "Firewall: 🟢\n" +
    "Approval Workflow: 🟢\n" +
    "Follow-up Engine: 🟢\n\n" +
    "Semua sistem online. Gunakan /wa-setup untuk panduan."
  );
  startFollowUpLoop(client);
});

client.on("authenticated", () => console.log("[WA] Authenticated"));
client.on("change_state", (state) => console.log("[WA] State:", state));
client.on("auth_failure", async (msg) => {
  console.error("[WA] Auth gagal:", msg);
  await notifyTelegram("❌ WhatsApp auth gagal. Restart untuk scan ulang.");
});
client.on("disconnected", async (reason) => {
  console.error("[WA] Disconnected:", reason);
  await notifyTelegram(`⚠️ WhatsApp terputus: ${reason}\nSedang reconnect...`);
});

client.on("message", handleMessage);
client.on("message_create", handleMessage);

async function start() {
  console.log("[WA] Starting WhatsApp client dengan Contact Intelligence System...");
  try {
    await client.initialize();
  } catch (err) {
    console.error("[WA] Initialize error:", err.message);
    await notifyTelegram(`❌ WhatsApp gagal start: ${err.message}`);
    process.exit(1);
  }
}

module.exports = { start, client, notifyTelegram };
