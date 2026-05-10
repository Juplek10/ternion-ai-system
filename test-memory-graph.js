const {
  addNode,
  addEdge,
  loadGraph
} = require(
  "./core/memory-graph"
);

async function test() {

  await addNode({

    type:
      "project",

    name:
      "RAB Gudang"
  });

  await addNode({

    type:
      "vendor",

    name:
      "PT Beton Maju"
  });

  await addEdge(
    "RAB Gudang",
    "PT Beton Maju",
    "uses-vendor"
  );

  const graph =
    await loadGraph();

  console.log(
    JSON.stringify(
      graph,
      null,
      2
    )
  );
}

test();
