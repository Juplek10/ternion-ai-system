require("dotenv").config();

const {
  createApproval
} = require(
  "./core/approval-engine"
);

// Global error guards — cegah crash dari unhandled error
process.on("uncaughtException", (err) => {
  console.error("[BG-WORKER] uncaughtException:", err.message);
});
process.on("unhandledRejection", (reason) => {
  console.error("[BG-WORKER] unhandledRejection:", reason instanceof Error ? reason.message : String(reason));
});

async function backgroundLoop() {

  console.log(
    "\n===================="
  );

  console.log(
    "BACKGROUND AI ACTIVE"
  );

  console.log(
    new Date().toISOString()
  );

  console.log(
    "===================="
  );

  await createApproval({

    type:
      "background-report",

    description:
      "AI background worker heartbeat"
  });
}

backgroundLoop();

setInterval(
  backgroundLoop,
  60000
);
