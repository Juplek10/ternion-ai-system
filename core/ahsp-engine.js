const priceDatabase = {

  materials: {

    "Semen": 75000,
    "Pasir": 300000,
    "Kerikil": 350000,
    "Besi Beton": 14000000,
    "Wiremesh": 1200000,

    "Baja WF": 17000000,
    "Plat Baja": 15000000,
    "Baut": 50000,

    "Cat": 120000,
    "Keramik": 150000,
    "Gypsum": 100000,
    "Atap": 250000,

    "Pipa": 80000,
    "Kabel": 250000,
    "Lampu": 150000,
    "Panel": 3000000
  },

  labor: {

    "Tukang Beton": 180000,
    "Pekerja": 150000,
    "Mandor": 250000,

    "Tukang Las": 250000,
    "Pekerja Baja": 180000,

    "Tukang Bangunan": 170000,
    "Pekerja Finishing": 160000,

    "Teknisi Listrik": 250000,
    "Teknisi Plumbing": 230000
  },

  equipment: {

    "Molen": 300000,
    "Concrete Vibrator": 150000,

    "Mesin Las": 250000,
    "Gerinda": 100000,

    "Scaffolding": 500000,

    "Bor": 100000,
    "Tangga": 50000
  }
};

function calculateAHSP(
  knowledge
) {

  let materialCost = 0;
  let laborCost = 0;
  let equipmentCost = 0;

  for(
    const material
    of knowledge.materials || []
  ) {

    materialCost +=
      priceDatabase.materials[
        material
      ] || 0;
  }

  for(
    const labor
    of knowledge.labor || []
  ) {

    laborCost +=
      priceDatabase.labor[
        labor
      ] || 0;
  }

  for(
    const equipment
    of knowledge.equipment || []
  ) {

    equipmentCost +=
      priceDatabase.equipment[
        equipment
      ] || 0;
  }

  return {

    materialCost,

    laborCost,

    equipmentCost,

    total:

      materialCost +
      laborCost +
      equipmentCost
  };
}

module.exports = {
  calculateAHSP
};
