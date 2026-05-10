const fs = require("fs-extra");

async function readLog(
  logPath
) {

  try {

    const content =
      await fs.readFile(
        logPath,
        "utf8"
      );

    return {
      success: true,
      content
    };

  } catch(err) {

    return {
      success: false,
      error: err.message
    };
  }
}

async function detectErrors(
  logContent
) {

  const lines =
    logContent.split("\n");

  const errors =
    lines.filter(
      line =>
        line.toLowerCase()
          .includes("error") ||

        line.toLowerCase()
          .includes("failed") ||

        line.toLowerCase()
          .includes("exception")
    );

  return errors;
}

module.exports = {
  readLog,
  detectErrors
};
