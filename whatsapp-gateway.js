require("dotenv").config();

process.on("unhandledRejection", (reason) => {
  console.error("[WA_GATEWAY] Unhandled rejection:", reason instanceof Error ? reason.message : String(reason));
});
process.on("uncaughtException", (err) => {
  console.error("[WA_GATEWAY] Uncaught exception:", err.message);
});

const { start } = require("./core/integrations/whatsapp");

console.log("[WA_GATEWAY] TERNION-AI WhatsApp Gateway starting...");
start();
