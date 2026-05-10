const {
  loadGraph
} = require(
  "./memory-graph"
);

async function recallMemory(
  keyword
) {

  const graph =
    await loadGraph();

  const lower =
    keyword.toLowerCase();

  const matchingNodes =
    graph.nodes.filter(
      node =>

        JSON.stringify(node)
          .toLowerCase()
          .includes(lower)
    );

  const relatedEdges =
    graph.edges.filter(
      edge =>

        JSON.stringify(edge)
          .toLowerCase()
          .includes(lower)
    );

  return {

    keyword,

    matchingNodes,

    relatedEdges
  };
}

module.exports =
  recallMemory;
