function extractDimensions(
  text
) {

  const result = {

    length: null,
    width: null,
    height: null,
    quantity: 1
  };

  const dimensionMatch =
    text.match(
      /(\d+)[x\/](\d+)/i
    );

  if(
    dimensionMatch
  ) {

    result.length =
      parseFloat(
        dimensionMatch[1]
      ) / 100;

    result.width =
      parseFloat(
        dimensionMatch[2]
      ) / 100;
  }

  const heightMatch =
    text.match(
      /tinggi\s+(\d+(\.\d+)?)/i
    );

  if(
    heightMatch
  ) {

    result.height =
      parseFloat(
        heightMatch[1]
      );
  }

  const quantityMatch =
    text.match(
      /jumlah\s+(\d+)/i
    );

  if(
    quantityMatch
  ) {

    result.quantity =
      parseInt(
        quantityMatch[1]
      );
  }

  return result;
}

function calculateRealVolume(
  dimensions
) {

  if(
    !dimensions.length ||
    !dimensions.width ||
    !dimensions.height
  ) {

    return 0;
  }

  return (

    dimensions.length *

    dimensions.width *

    dimensions.height *

    dimensions.quantity
  );
}

module.exports = {

  extractDimensions,

  calculateRealVolume
};
