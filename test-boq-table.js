const {
  parseBOQTable
} = require(
  "./core/boq-table-parser"
);

const text = `

Beton fc 25 | 45 | m3
Besi D16 | 2.5 | ton
Atap Spandek | 120 | m2
Plumbing | 40 | titik

`;

const result =
  parseBOQTable(
    text
  );

console.log(
  JSON.stringify(
    result,
    null,
    2
  )
);
