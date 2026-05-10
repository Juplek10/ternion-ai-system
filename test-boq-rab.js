const {
  parseBOQTable
} = require(
  "./core/boq-table-parser"
);

const {
  generateBOQRAB
} = require(
  "./core/boq-rab-engine"
);

const text = `

Beton fc 25 | 45 | m3
Besi D16 | 2.5 | ton
Atap Spandek | 120 | m2
Plumbing | 40 | titik

`;

const boq =
  parseBOQTable(
    text
  );

const rab =
  generateBOQRAB(
    boq
  );

console.log(
  JSON.stringify(
    rab,
    null,
    2
  )
);


