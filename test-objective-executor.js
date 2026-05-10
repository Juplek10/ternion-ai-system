const {
  executeObjective
} = require(
  "./core/objective-executor"
);

async function test() {

  const result =
    await executeObjective({

      title:
        "Bangun Sistem RAB Otomatis"
    });

  console.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );
}

test();
