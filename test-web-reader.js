const {
  readWebPage
} = require(
  "./core/web-reader"
);

async function test() {

  const result =
    await readWebPage(

      "https://example.com"
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
