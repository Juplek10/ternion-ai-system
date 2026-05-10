const {
  classifyBOQItem
} = require(
  "./core/boq-classifier"
);

const {
  getBOQKnowledge
} = require(
  "./core/boq-knowledge"
);

const items = [

  "Struktur Beton",
  "Pekerjaan Baja",
  "Panel Listrik"
];

for(
  const item
  of items
) {

  const classified =
    classifyBOQItem(
      item
    );

  const knowledge =
    getBOQKnowledge(
      classified.category
    );

  console.log(
    "\n===================="
  );

  console.log(
    item
  );

  console.log(
    JSON.stringify(
      knowledge,
      null,
      2
    )
  );
}
