const {
  analyzePDF
} = require(
  "./pdf-intelligence"
);

const {
  extractKnowledge
} = require(
  "./document-extractor"
);

const {
  addMemory
} = require(
  "./vector-memory"
);

async function learnDocument(
  filePath
) {

  const pdf =
    await analyzePDF(
      filePath
    );

  if(!pdf.success) {

    return pdf;
  }

  const knowledge =
    extractKnowledge(
      pdf.fullText
    );

  const memories = [];

  if(
    knowledge.projectName
  ) {

    memories.push(

      `Project ${knowledge.projectName} berada di ${knowledge.location}`
    );
  }

  if(
    knowledge.vendor
  ) {

    memories.push(

      `Vendor utama proyek ${knowledge.projectName} adalah ${knowledge.vendor}`
    );
  }

  for(
    const item
    of knowledge.workItems
  ) {

    memories.push(

      `Item pekerjaan proyek ${knowledge.projectName}: ${item}`
    );
  }

  for(
    const memory
    of memories
  ) {

    await addMemory(
      memory,
      {
        source:
          filePath,

        project:
          knowledge.projectName
      }
    );
  }

  return {

    success: true,

    knowledge,

    memoriesSaved:
      memories.length
  };
}

module.exports = {
  learnDocument
};
