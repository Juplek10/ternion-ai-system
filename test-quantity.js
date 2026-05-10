const {
  calculateConcreteVolume,
  estimateConcreteMaterials,
  estimateConcreteCost
} = require(
  "./core/quantity-engine"
);

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

const volume =
  calculateConcreteVolume(
    5,
    0.3,
    3
  );

const materials =
  estimateConcreteMaterials(
    volume
  );

const estimatedCost =
  estimateConcreteCost(
    volume,
    ahsp.total
  );

console.log(
  JSON.stringify(
    {

      item,

      volume,

      materials,

      estimatedCost

    },
    null,
    2
  )
);
