const fs =
  require("fs");

const path =
  require("path");

function buildCapability(
  capabilityName
) {

  const safeName =
    capabilityName
      .toLowerCase()
      .replace(/\s+/g, "-");

  const coreFile =
    `/root/ai-system/core/${safeName}.js`;

  const testFile =
    `/root/ai-system/test-${safeName}.js`;

  const code = `

function run() {

  return {

    success: true,

    capability:
      "${capabilityName}",

    message:
      "Capability active"
  };
}

module.exports = {
  run
};

`;

  const testCode = `

const {
  run
} = require(
  "./core/${safeName}"
);

console.log(
  JSON.stringify(
    run(),
    null,
    2
  )
);

`;

  fs.writeFileSync(
    coreFile,
    code
  );

  fs.writeFileSync(
    testFile,
    testCode
  );

  return {

    success: true,

    capability:
      capabilityName,

    coreFile,

    testFile
  };
}

module.exports = {
  buildCapability
};
