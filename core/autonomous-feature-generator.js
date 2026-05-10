const fs =
  require("fs");

const path =
  require("path");

function generateModule(
  moduleName
) {

  const modulePath =

    path.join(

      "/root/ai-system/core",

      moduleName
    );

  if(
    fs.existsSync(
      modulePath
    )
  ) {

    return {

      skipped: true,

      module:
        moduleName
    };
  }

  const content =

`function execute(input) {

  return {
    success: true,
    module: "${moduleName}",
    input
  };
}

module.exports = {
  execute
};
`;

  fs.writeFileSync(

    modulePath,

    content
  );

  return {

    success: true,

    module:
      moduleName
  };
}

function generateTest(
  testName,
  moduleName
) {

  const testPath =

    path.join(

      "/root/ai-system",

      testName
    );

  if(
    fs.existsSync(
      testPath
    )
  ) {

    return {

      skipped: true,

      test:
        testName
    };
  }

  const content =

`const {

  execute

} = require(

  "./core/${moduleName}"
);

const result =

  execute({

    test: true
  });

console.log(
  JSON.stringify(
    result,
    null,
    2
  )
);
`;

  fs.writeFileSync(

    testPath,

    content
  );

  return {

    success: true,

    test:
      testName
  };
}

function generateFeature(
  plan
) {

  const results = {

    modules: [],

    tests: []
  };

  for(
    let i = 0;
    i <
    plan.requiredModules.length;
    i++
  ) {

    const moduleName =

      plan.requiredModules[i];

    const testName =

      plan.requiredTests[i];

    results.modules.push(

      generateModule(
        moduleName
      )
    );

    results.tests.push(

      generateTest(
        testName,
        moduleName
      )
    );
  }

  return results;
}

module.exports = {
  generateFeature
};
