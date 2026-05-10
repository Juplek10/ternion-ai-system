const fs =
  require("fs");

const path =
  require("path");

const {

  execSync

} = require(
  "child_process"
);

const SAFE_COMMANDS = [

  "ls",
  "pwd",
  "node -v"
];

const SAFE_DIRECTORIES = [

  "/root/ai-system/sandbox",
  "/root/ai-system/agents"
];

function validateCommand(
  command
) {

  return SAFE_COMMANDS
    .includes(command);
}

function validatePath(
  targetPath
) {

  return SAFE_DIRECTORIES
    .some(dir =>

      targetPath
      .startsWith(dir)
    );
}

function safeExecuteCommand(
  command
) {

  if(
    !validateCommand(
      command
    )
  ) {

    return {

      allowed: false,

      reason:
        "Command not allowed"
    };
  }

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

      allowed: true,

      output
    };

  } catch(error) {

    return {

      allowed: false,

      error:
        error.message
    };
  }
}

function safeWriteFile(
  targetPath,
  content
) {

  if(
    !validatePath(
      targetPath
    )
  ) {

    return {

      allowed: false,

      reason:
        "Path not allowed"
    };
  }

  fs.writeFileSync(
    targetPath,
    content
  );

  return {

    allowed: true,

    file:
      targetPath
  };
}

module.exports = {

  safeExecuteCommand,

  safeWriteFile
};

