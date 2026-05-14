require("dotenv").config();
const { getContact, listContacts } = require("../contacts/contact-manager");

// Lazy load WA client untuk hindari circular deps
function getWAClient() {
  try {
    return require("../integrations/whatsapp").client;
  } catch {
    return null;
  }
}

async function isClientReady() {
  const client = getWAClient();
  if (!client) return false;
  try {
    const state = await client.getState();
    return state === "CONNECTED";
  } catch {
    return false;
  }
}

async function sendToContact(nomor, pesan) {
  const client = getWAClient();
  if (!client) throw new Error("WA client tidak tersedia. Pastikan WhatsApp sudah terhubung.");
  const clean = nomor.replace("+", "").replace("@c.us", "").replace(/\s/g, "");
  await client.sendMessage(`${clean}@c.us`, pesan);
  return { success: true, nomor: clean };
}

async function sendToGroup(groupId, pesan) {
  const client = getWAClient();
  if (!client) throw new Error("WA client tidak tersedia.");
  const gid = groupId.endsWith("@g.us") ? groupId : `${groupId}@g.us`;
  await client.sendMessage(gid, pesan);
  return { success: true, groupId };
}

async function getContactList() {
  const contacts = await listContacts();
  return contacts.filter(c => !c.nomor.includes("XXXXXXX") && !c.nomor.startsWith("_"));
}

async function getRecentChats(limit = 10) {
  const client = getWAClient();
  if (!client) return [];
  try {
    const chats = await client.getChats();
    const result = [];
    for (const c of chats) {
      if (c.isGroup) continue;
      const nomor = c.id.user;
      const kontak = await getContact(nomor).catch(() => null);
      result.push({
        id: c.id._serialized,
        name: kontak?.nama || c.name || nomor,
        nomor,
        kategori: kontak?.kategori || "tidak_dikenal",
        lastMessage: c.lastMessage?.body?.substring(0, 80) || "(media)",
        timestamp: c.timestamp,
        timeStr: c.timestamp
          ? new Date(c.timestamp * 1000).toLocaleTimeString("id-ID", {
              hour: "2-digit", minute: "2-digit", timeZone: "Asia/Makassar"
            })
          : "—"
      });
      if (result.length >= limit) break;
    }
    return result;
  } catch (err) {
    console.error("[WA-CTRL] getRecentChats:", err.message);
    return [];
  }
}

async function getMessages(nomor, limit = 15) {
  const client = getWAClient();
  if (!client) return [];
  try {
    const clean = nomor.replace("+", "").replace("@c.us", "");
    const chat = await client.getChatById(`${clean}@c.us`);
    const messages = await chat.fetchMessages({ limit });
    return messages.map(m => ({
      body: m.body || "(media)",
      fromMe: m.fromMe,
      timeStr: new Date(m.timestamp * 1000).toLocaleTimeString("id-ID", {
        hour: "2-digit", minute: "2-digit", timeZone: "Asia/Makassar"
      })
    }));
  } catch (err) {
    console.error("[WA-CTRL] getMessages:", err.message);
    return [];
  }
}

async function broadcastToCategory(kategori, pesan) {
  const contacts = await listContacts(kategori);
  const valid = contacts.filter(c =>
    !c.nomor.includes("XXXXXXX") &&
    !c.nomor.startsWith("_") &&
    c.kategori !== "nexus"
  );
  const results = { sent: [], failed: [] };
  for (const c of valid) {
    try {
      await sendToContact(c.nomor, pesan);
      results.sent.push(c.nama || c.nomor);
      await new Promise(r => setTimeout(r, 1500)); // Rate limit
    } catch {
      results.failed.push(c.nama || c.nomor);
    }
  }
  return results;
}

module.exports = {
  isClientReady,
  sendToContact,
  sendToGroup,
  getContactList,
  getRecentChats,
  getMessages,
  broadcastToCategory
};
