const {
  addMemory,
  searchMemory
} = require(
  "./core/vector-memory"
);

async function test() {

  await addMemory(

    "Vendor beton PT Beton Maju digunakan pada proyek gudang",

    {
      project:
        "Gudang"
    }
  );

  await addMemory(

    "Vendor baja PT Baja Kuat digunakan pada proyek jembatan",

    {
      project:
        "Jembatan"
    }
  );

  const result =
    await searchMemory(
      "vendor beton gudang"
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
