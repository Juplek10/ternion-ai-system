const {
  analyzePDF
} = require(
  "./core/pdf-intelligence"
);

const {
  extractKnowledge
} = require(
  "./core/document-extractor"
);

async function test() {

  const pdf =
    await analyzePDF(
      "/root/ai-system/docs/tender.pdf"
    );

  const knowledge =
    extractKnowledge(
      pdf.fullText
    );

  console.log(
    JSON.stringify(
      knowledge,
      null,
      2
    )
  );
}

test();
