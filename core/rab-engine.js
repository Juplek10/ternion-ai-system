const {
  classifyBOQItem
} = require(
  "./boq-classifier"
);

const {
  getBOQKnowledge
} = require(
  "./boq-knowledge"
);

const {
  calculateAHSP
} = require(
  "./ahsp-engine"
);

const {
  calculateConcreteVolume,
  estimateConcreteMaterials,
  estimateConcreteCost
} = require(
  "./quantity-engine"
);

function generateRAB(
  item,
  dimensions
) {

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

      dimensions.length,

      dimensions.width,

      dimensions.height
    );

  const materials =
    estimateConcreteMaterials(
      volume
    );

  const totalCost =
    estimateConcreteCost(
      volume,
      ahsp.total
    );

  return {

    item,

    category:
      classified.category,

    volume,

    materials,

    ahsp,

    totalCost
  };
}

module.exports = {
  generateRAB
};


