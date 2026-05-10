function calculateConcreteVolume(
  length,
  width,
  height
) {

  return (
    length *
    width *
    height
  );
}

function estimateConcreteMaterials(
  volume
) {

  return {

    semen:
      volume * 8,

    pasir:
      volume * 0.5,

    kerikil:
      volume * 0.7,

    besi:
      volume * 120
  };
}

function estimateConcreteCost(
  volume,
  ahspTotal
) {

  return volume *
    ahspTotal;
}

module.exports = {

  calculateConcreteVolume,

  estimateConcreteMaterials,

  estimateConcreteCost
};
