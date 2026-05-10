const analyzeErrors =
  require(
    "./core/error-analyzer"
  );

const suggestPatch =
  require(
    "./core/patch-engine"
  );

async function test() {

  const errors = [

    "SyntaxError: Unexpected token",

    "MODULE_NOT_FOUND"
  ];

  const analysis =
    await analyzeErrors(
      errors
    );

  const patches =
    await suggestPatch(
      analysis
    );

  console.log(
    JSON.stringify(
      patches,
      null,
      2
    )
  );
}

test();
