const {
  classifyBOQItem
} = require(
  "./boq-classifier"
);

const AHSP = {

  STRUCTURE: {
    unitCost:
      16955000
  },

  STEEL: {
    unitCost:
      32830000
  },

  ARCHITECTURE: {
    unitCost:
      1450000
  },

  MEP: {
    unitCost:
      4110000
  },

  LANDSCAPE: {
    unitCost:
      950000
  }
};

function generateBOQRAB(
  boqItems
) {

  const results = [];

  let grandTotal = 0;

  for(
    const item
    of boqItems
  ) {

    const classification =
      classifyBOQItem(
        item.item
      );

    const category =
      classification.category;

    const unitCost =
      AHSP[
        category
      ]?.unitCost || 0;

    const totalCost =
      unitCost *
      item.volume;

    grandTotal +=
      totalCost;

    results.push({

      item:
        item.item,

      category,

      volume:
        item.volume,

      unit:
        item.unit,

      unitCost,

      totalCost
    });
  }

  return {

    items:
      results,

    grandTotal
  };
}

module.exports = {
  generateBOQRAB
};
