const {
  generateProjectRAB
} = require(
  "./core/multi-rab-engine"
);

const projectItems = [

  {
    name:
      "Struktur Beton",

    dimensions: {

      length: 5,
      width: 0.3,
      height: 3
    }
  },

  {
    name:
      "Pekerjaan Baja",

    dimensions: {

      length: 4,
      width: 0.2,
      height: 2
    }
  },

  {
    name:
      "Atap",

    dimensions: {

      length: 6,
      width: 0.1,
      height: 2
    }
  }
];

const rab =
  generateProjectRAB(
    projectItems
  );

console.log(
  JSON.stringify(
    rab,
    null,
    2
  )
);
