const {
  generateRAB
} = require(
  "./core/rab-engine"
);

const rab =
  generateRAB(

    "Struktur Beton",

    {
      length: 5,
      width: 0.3,
      height: 3
    }
  );

console.log(
  JSON.stringify(
    rab,
    null,
    2
  )
);
