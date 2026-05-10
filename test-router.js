require("dotenv").config();

const routeTask = require("./core/router/router");

async function run() {

  try {

    const result = await routeTask(
      "heartbeat",
      "Say hello briefly."
    );

    console.log(result);

  } catch(err) {

    console.error(err.message);

  }
}

run();
