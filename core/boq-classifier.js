const categories = {

  STRUCTURE: [

    "beton",
    "pondasi",
    "sloof",
    "kolom",
    "balok",
    "plat",
    "struktur"
  ],

  STEEL: [

    "baja",
    "wf",
    "kuda-kuda",
    "bracing"
  ],

  ARCHITECTURE: [

    "atap",
    "plafon",
    "keramik",
    "cat",
    "dinding",
    "pintu",
    "jendela"
  ],

  MEP: [

    "plumbing",
    "listrik",
    "lampu",
    "panel",
    "kabel",
    "air"
  ],

  LANDSCAPE: [

    "taman",
    "drainase",
    "rumput",
    "pagar"
  ]
};

function classifyBOQItem(
  item
) {

  const lower =
    item.toLowerCase();

  for(
    const category
    of Object.keys(
      categories
    )
  ) {

    const keywords =
      categories[
        category
      ];

    for(
      const keyword
      of keywords
    ) {

      if(
        lower.includes(
          keyword
        )
      ) {

        return {

          item,

          category,

          matchedKeyword:
            keyword
        };
      }
    }
  }

  return {

    item,

    category:
      "UNKNOWN",

    matchedKeyword:
      null
  };
}

module.exports = {
  classifyBOQItem
};
