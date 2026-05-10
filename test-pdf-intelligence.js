const {
  analyzePDF
} = require(
  "./core/pdf-intelligence"
);

async function test() {

  const result =
    await analyzePDF(
      "/root/ai-system/docs/tender.pdf"
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
