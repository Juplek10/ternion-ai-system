const {
  generateRABFromDocument
} = require(
  "./core/document-rab-pipeline"
);

async function test() {

  const result =
    await generateRABFromDocument(

      "./docs/tender.pdf"
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
