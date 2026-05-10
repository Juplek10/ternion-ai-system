const {

  extractDimensions,

  calculateRealVolume

} = require(
  "./core/quantity-extractor"
);

const text = `

Kolom Beton 30/30
Tinggi 4
Jumlah 12

`;

const dimensions =
  extractDimensions(
    text
  );

const volume =
  calculateRealVolume(
    dimensions
  );

console.log(
  JSON.stringify(
    {

      dimensions,

      volume

    },
    null,
    2
  )
);
