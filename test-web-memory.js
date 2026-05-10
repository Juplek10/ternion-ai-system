const {
  learnWebsite
} = require(
  "./core/web-memory"
);

const {
  searchMemory
} = require(
  "./core/vector-memory"
);

async function test() {

  const learn =
    await learnWebsite(

      "https://example.com"
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
      "documentation domain"
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
