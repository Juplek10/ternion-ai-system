require("dotenv").config();

const {
  createApproval
} = require(
  "./core/approval-engine"
);

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
