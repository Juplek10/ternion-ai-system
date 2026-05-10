const {

  execSync

} = require(

  "child_process"
);

function runCommand(
  command
) {

  try {

    const output =

      execSync(
        command,
        {
          encoding:
            "utf8"
        }
      );

    return {

      success: true,

      output
    };

  } catch(error) {

    return {

      success: false,

      error:
        error.message,

      stderr:
        error.stderr
        ?.toString()
    };
  }
}

module.exports = {
  runCommand
};
