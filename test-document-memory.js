const {
  learnDocument
} = require(
  "./core/document-memory"
);

const {
  searchMemory
} = require(
  "./core/vector-memory"
);

async function test() {

  const learn =
    await learnDocument(
      "/root/ai-system/docs/tender.pdf"
    );

  console.log(
    "\nLEARN RESULT\n"
  );

  console.log(
    JSON.stringify(
      learn,
      null,
      2
    )
  );

  const memory =
    await searchMemory(
      "vendor proyek gudang"
    );

  console.log(
    "\nMEMORY SEARCH\n"
  );

  console.log(
    JSON.stringify(
      memory,
      null,
      2
    )
  );
}

test();
