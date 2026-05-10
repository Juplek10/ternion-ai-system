const {
  validatePatch
} = require(
  "./core/validation-loop"
);

const result =
  validatePatch({

    filePath:
      "/root/ai-system/sandbox/test.md",

    newContent:
      "VALID PATCH",

    testFile:
      "/root/ai-system/test-memory.js"
  });

console.log(
  JSON.stringify(
    result,
    null,
    2
  )
);
