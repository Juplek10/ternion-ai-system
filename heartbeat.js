require("dotenv").config();

function heartbeat() {
  console.log("================================");
  console.log("TERNION-AI HEARTBEAT");
  console.log("TIME:", new Date().toISOString());
  console.log("STATUS: online");
  console.log("================================");
}

heartbeat();

setInterval(
  heartbeat,
  process.env.HEARTBEAT_INTERVAL || 300000
);
