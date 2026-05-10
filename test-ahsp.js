const {
  classifyBOQItem
} = require(
  "./core/boq-classifier"
);

const {
  getBOQKnowledge
} = require(
  "./core/boq-knowledge"
);

const {
  calculateAHSP
} = require(
  "./core/ahsp-engine"
);

const item =
  "Struktur Beton";

const classified =
  classifyBOQItem(
    item
  );

const knowledge =
  getBOQKnowledge(
    classified.category
  );

const ahsp =
  calculateAHSP(
    knowledge
  );

console.log(
  JSON.stringify(
    {
      item,
      category:
        classified.category,
      knowledge,
      ahsp
    },
    null,
    2
  )
);
