function coordinateNodes(
  ecosystem
) {

  const actions = [];

  for(
    const node
    of ecosystem.nodes
  ) {

    if(
      node.load > 80
    ) {

      actions.push({

        node:
          node.name,

        action:
          "Redistribute Cognition",

        reason:
          "Node overload"
      });
    }

    if(
      node.crashed
    ) {

      actions.push({

        node:
          node.name,

        action:
          "Spawn Recovery Node",

        reason:
          "Node failure detected"
      });
    }

    if(
      node.latency > 100
    ) {

      actions.push({

        node:
          node.name,

        action:
          "Rebalance Orchestration",

        reason:
          "High distributed latency"
      });
    }
  }

  if(
    actions.length === 0
  ) {

    actions.push({

      action:
        "Maintain Distributed Stability",

      reason:
        "Distributed ecosystem stable"
    });
  }

  return {

    distributedEcosystem:
      true,

    actions
  };
}

module.exports = {
  coordinateNodes
};
