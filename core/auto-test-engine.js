const {
  execSync
} = require(
  "child_process"
);

function runTest(
  testFile
) {

  try {

    const output =
      execSync(

        `node ${testFile}`,

        {
          encoding:
            "utf8"
        }
      );

    return {

      success: true,

      output
    };

  } catch(err) {

    return {

      success: false,

      error:
        err.toString()
    };
  }
}

module.exports = {
  runTest
};
