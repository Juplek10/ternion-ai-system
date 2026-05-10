const detectGap =
  require(
    "./core/capability-gap"
  );

async function test() {

  const result =
    await detectGap(
      "Analisa PDF tender proyek"
    );

  console.log(result);
}

test();
