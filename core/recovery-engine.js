const {
  rollbackFile
} = require(
  "./rollback-engine"
);

const {
  exec
} = require(
  "child_process"
);

async function recoverSystem() {

  console.log(
    "\n===================="
  );

  console.log(
    "STARTING RECOVERY"
  );

  console.log(
    "===================="
  );

  const rollback =
    await rollbackFile(
      "worker.js"
    );

  console.log(
    rollback
  );

  return new Promise(
    (resolve) => {

      exec(
        "pm2 restart worker",

        (err, stdout, stderr) => {

          if(err) {

            resolve({

              success: false,

              error:
                err.message
            });

            return;
          }

          resolve({

            success: true,

            rollback,

            restart:
              stdout || stderr
          });
        }
      );
    }
  );
}

module.exports = {
  recoverSystem
};
