require("dotenv").config();

const routeTask = require("./core/router/router");

async function heartbeat() {

  try {

    const response = await routeTask(
      "heartbeat",
      "You are an autonomous AI heartbeat. Respond briefly."
    );

    console.log("================================");
    console.log("AI HEARTBEAT");
    console.log("TIME:", new Date().toISOString());
    console.log("================================");
    console.log(response);
    console.log("");

  } catch(err) {

    console.error("HEARTBEAT ERROR:");
    console.error(err.message);

  }
}

heartbeat();

setInterval(
  heartbeat,
  process.env.HEARTBEAT_INTERVAL || 300000
);
