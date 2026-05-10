const {

  learnKnowledge,

  searchKnowledge

} = require(

  "./core/construction-knowledge-engine"
);

learnKnowledge({

  type:
    "terms",

  content:
    "AHSP adalah Analisa Harga Satuan Pekerjaan"
});

learnKnowledge({

  type:
    "vendors",

  content:
    "PT Beton Maju spesialis struktur beton"
});

learnKnowledge({

  type:
    "risks",

  content:
    "Harga baja fluktuatif"
});

const result =

  searchKnowledge(
    "beton"
  );

console.log(
  JSON.stringify(
    result,
    null,
    2
  )
);

