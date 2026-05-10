const analyzeErrors =
  require(
    "./core/error-analyzer"
  );

async function test() {

  const errors = [

    "SyntaxError: Unexpected token",

    "MODULE_NOT_FOUND"
  ];

  const result =
    await analyzeErrors(
      errors
    );

  console.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );
}

test();
