require("dotenv").config();

const {
  readLog,
  detectErrors
} = require(
  "./core/log-monitor"
);

const {
  recoverSystem
} = require(
  "./core/recovery-engine"
);

async function monitor() {

  console.log(
    "\n===================="
  );

  console.log(
    "MONITOR LOOP ACTIVE"
  );

  console.log(
    new Date().toISOString()
  );

  console.log(
    "===================="
  );

  const log =
    await readLog(
      "/root/.pm2/logs/worker-error.log"
    );

  if(!log.success) {

    console.log(
      "FAILED TO READ LOG"
    );

    return;
  }

  const errors =
    await detectErrors(
      log.content
    );

  console.log(
    "ERROR COUNT:",
    errors.length
  );

  if(errors.length > 0) {

    console.log(
      "ERROR DETECTED"
    );

    const recovery =
      await recoverSystem();

    console.log(
      recovery
    );
  }
}

monitor();

setInterval(
  monitor,
  60000
);

