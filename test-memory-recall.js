const recallMemory =
  require(
    "./core/memory-recall"
  );

async function test() {

  const result =
    await recallMemory(
      "vendor"
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
