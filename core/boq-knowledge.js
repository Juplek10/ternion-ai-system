const knowledgeBase = {

  STRUCTURE: {

    materials: [

      "Semen",
      "Pasir",
      "Kerikil",
      "Besi Beton",
      "Wiremesh"
    ],

    labor: [

      "Tukang Beton",
      "Pekerja",
      "Mandor"
    ],

    equipment: [

      "Molen",
      "Concrete Vibrator"
    ]
  },

  STEEL: {

    materials: [

      "Baja WF",
      "Plat Baja",
      "Baut"
    ],

    labor: [

      "Tukang Las",
      "Pekerja Baja"
    ],

    equipment: [

      "Mesin Las",
      "Gerinda"
    ]
  },

  ARCHITECTURE: {

    materials: [

      "Cat",
      "Keramik",
      "Gypsum",
      "Atap"
    ],

    labor: [

      "Tukang Bangunan",
      "Pekerja Finishing"
    ],

    equipment: [

      "Scaffolding"
    ]
  },

  MEP: {

    materials: [

      "Pipa",
      "Kabel",
      "Lampu",
      "Panel"
    ],

    labor: [

      "Teknisi Listrik",
      "Teknisi Plumbing"
    ],

    equipment: [

      "Bor",
      "Tangga"
    ]
  },

  LANDSCAPE: {

    materials: [

      "Rumput",
      "Paving",
      "Pagar"
    ],

    labor: [

      "Tukang Taman"
    ],

    equipment: [

      "Pemotong Rumput"
    ]
  }
};

function getBOQKnowledge(
  category
) {

  return knowledgeBase[
    category
  ] || null;
}

module.exports = {
  getBOQKnowledge
};

