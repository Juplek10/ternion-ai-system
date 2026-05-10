const {
  readLog,
  detectErrors
} = require(
  "./core/log-monitor"
);

async function test() {

  const result =
    await readLog(
      "/root/.pm2/logs/worker-error.log"
    );

  if(!result.success) {

    console.log(result);

    return;
  }

  const errors =
    await detectErrors(
      result.content
    );

  console.log(errors);
}

test();
