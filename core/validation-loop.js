const fs =
  require("fs");

const {

  applyPatch,

  rollback

} = require(
  "./safe-patch-loop"
);

const {
  runTest
} = require(
  "./auto-test-engine"
);

function validatePatch({

  filePath,

  newContent,

  testFile
}) {

  const original =
    fs.readFileSync(
      filePath,
      "utf8"
    );

  const backup =
    applyPatch(

      filePath,

      newContent
    );

  const test =
    runTest(
      testFile
    );

  if(
    !test.success
  ) {

    rollback(
      filePath,
      backup
    );

    return {

      success: false,

      rollback: true,

      test
    };
  }

  return {

    success: true,

    rollback: false,

    test
  };
}

module.exports = {
  validatePatch
};
