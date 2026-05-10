const fs = require("fs");

const pdfjsLib =
  require("pdfjs-dist/legacy/build/pdf.mjs");

async function analyzePDF(
  filePath
) {

  try {

    const data =
      new Uint8Array(
        fs.readFileSync(
          filePath
        )
      );

    const pdf =
      await pdfjsLib.getDocument({
        data
      }).promise;

    let fullText = "";

    for(
      let pageNum = 1;
      pageNum <= pdf.numPages;
      pageNum++
    ) {

      const page =
        await pdf.getPage(
          pageNum
        );

      const content =
        await page.getTextContent();

      const strings =
        content.items.map(
          item => item.str
        );

      fullText +=
        strings.join(" ")
        + "\n";
    }

    const words =
      fullText
        .split(/\s+/)
        .filter(Boolean)
        .length;

    return {

      success: true,

      pages:
        pdf.numPages,

      words,

      preview:
        fullText.substring(
          0,
          1000
        ),

      fullText
    };

  } catch(err) {

    return {

      success: false,

      error:
        err.message
    };
  }
}

module.exports = {
  analyzePDF
};
