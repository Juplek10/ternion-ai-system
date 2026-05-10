const fs =
  require("fs");

const {

  execSync

} = require(
  "child_process"
);

const {

  getRuntimeHealth

} = require(

  "./runtime-intelligence"
);

function cleanupLogs() {

  const logPath =

    "/root/ai-system/logs";

  if(
    !fs.existsSync(
      logPath
    )
  ) {

    return {
      skipped: true
    };
  }

  const files =

    fs.readdirSync(
      logPath
    );

  for(
    const file
    of files
  ) {

    if(
      file.endsWith(
        ".log"
      )
    ) {

      fs.unlinkSync(

        `${logPath}/${file}`
      );
    }
  }

  return {
    success: true
  };
}

function restartWorker() {

  try {

    execSync(

      "pm2 restart all"
    );

    return {
      success: true
    };

  } catch(err) {

    return {

      success: false,

      error:
        err.toString()
    };
  }
}

function autonomousOperations() {

  const health =

    getRuntimeHealth();

  const actions = [];

  const memoryUsage =

    parseFloat(
      health.memoryUsage
    );

  if(
    memoryUsage > 80
  ) {

    actions.push({

      action:
        "cleanup-logs",

      result:
        cleanupLogs()
    });
  }

  if(
    health.cpuLoad >
    health.cpuCores
  ) {

    actions.push({

      action:
        "restart-worker",

      result:
        restartWorker()
    });
  }

  return {

    success: true,

    health,

    actions
  };
}

module.exports = {
  autonomousOperations
};
