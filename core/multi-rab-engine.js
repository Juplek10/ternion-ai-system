const {
  generateRAB
} = require(
  "./rab-engine"
);

function generateProjectRAB(
  items
) {

  const results = [];

  let grandTotal = 0;

  const categoryTotals = {};

  for(
    const item
    of items
  ) {

    const rab =
      generateRAB(

        item.name,

        item.dimensions
      );

    results.push(
      rab
    );

    grandTotal +=
      rab.totalCost;

    if(
      !categoryTotals[
        rab.category
      ]
    ) {

      categoryTotals[
        rab.category
      ] = 0;
    }

    categoryTotals[
      rab.category
    ] += rab.totalCost;
  }

  return {

    items:
      results,

    categoryTotals,

    grandTotal
  };
}

module.exports = {
  generateProjectRAB
};
