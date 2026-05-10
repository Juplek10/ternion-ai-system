const {
  decomposeObjective
} = require(
  "./core/objective-planner"
);

async function test() {

  const result =
    await decomposeObjective({

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
