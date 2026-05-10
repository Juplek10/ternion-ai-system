const {

  learnFromInternet

} = require(

  "./core/internet-learning-engine"
);

async function test() {

  const result =

    await learnFromInternet(

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
