const fs = require("fs-extra");

const GRAPH_FILE =
  "/root/ai-system/memory-graph.json";

async function loadGraph() {

  try {

    return await fs.readJson(
      GRAPH_FILE
    );

  } catch(err) {

    return {
      nodes: [],
      edges: []
    };
  }
}

async function saveGraph(
  graph
) {

  await fs.writeJson(
    GRAPH_FILE,
    graph,
    { spaces: 2 }
  );
}

async function addNode(
  node
) {

  const graph =
    await loadGraph();

  graph.nodes.push({

    id:
      Date.now(),

    createdAt:
      new Date().toISOString(),

    ...node
  });

  await saveGraph(
    graph
  );

  return graph;
}

async function addEdge(
  from,
  to,
  relation
) {

  const graph =
    await loadGraph();

  graph.edges.push({

    from,
    to,
    relation
  });

  await saveGraph(
    graph
  );

  return graph;
}

module.exports = {

  loadGraph,

  addNode,

  addEdge
};
