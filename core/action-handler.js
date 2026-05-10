const { exec } =
  require("child_process");

async function handleAction(
  approval
) {

  return new Promise(
    (resolve) => {

      if(
        approval.description
          .toLowerCase()
          .includes("restart worker")
      ) {

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

              action:
                "restart-worker",

              output:
                stdout || stderr
            });
          }
        );
      }

      else {

        resolve({

          success: false,

          message:
            "No handler available"
        });
      }
    }
  );
}

module.exports = {
  handleAction
};
