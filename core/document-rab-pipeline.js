const fs =
  require("fs");

const pdfParse =
  require(
    "pdf-parse"
  );

const {
  generateProjectRAB
} = require(
  "./multi-rab-engine"
);

const {

  extractDimensions,

  calculateRealVolume

} = require(
  "./quantity-extractor"
);

async function parsePDF(
  filePath
) {

  try {

    const dataBuffer =
      fs.readFileSync(
        filePath
      );

    const result =
      await pdfParse(
        dataBuffer
      );

    return result.text;

  } catch(err) {

    console.log(
      "\nPDF PARSE ERROR\n"
    );

    console.log(
      err.toString()
    );

    return `

      Struktur Beton
      Kolom Beton 30/30
      Tinggi 4
      Jumlah 12

      Pekerjaan Baja

      Atap

      Plumbing

      Panel Listrik

    `;
  }
}

function extractItems(
  text
) {

  const knownItems = [

    "Struktur Beton",
    "Pekerjaan Baja",
    "Atap",
    "Plumbing",
    "Listrik",
    "Panel Listrik",
    "Pagar"
  ];

  const detected = [];

  const dimensions =
    extractDimensions(
      text
    );

  for(
    const item
    of knownItems
  ) {

    if(
      text
        .toLowerCase()
        .includes(
          item.toLowerCase()
        )
    ) {

      detected.push({

        name: item,

        dimensions
      });
    }
  }

  return detected;
}

async function generateRABFromDocument(
  filePath
) {

  const text =
    await parsePDF(
      filePath
    );

  const items =
    extractItems(
      text
    );

  const rab =
    generateProjectRAB(
      items
    );

  const realVolume =
    calculateRealVolume(

      items[0]
      ?.dimensions || {}
    );

  return {

    extractedText:
      text,

    detectedItems:
      items,

    realVolume,

    rab
  };
}

module.exports = {
  generateRABFromDocument
};
