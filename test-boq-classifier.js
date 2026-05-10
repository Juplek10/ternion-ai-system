const {
  classifyBOQItem
} = require(
  "./core/boq-classifier"
);

const items = [

  "Struktur Beton",
  "Pekerjaan Baja",
  "Atap",
  "Plumbing",
  "Panel Listrik",
  "Pagar Proyek"
];

for(
  const item
  of items
) {

  const result =
    classifyBOQItem(
      item
    );

  console.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );
}
