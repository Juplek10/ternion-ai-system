function monitorRuntime(
  system
) {

  const actions = [];

  if(
    system.cpuLoad > 80
  ) {

    actions.push({

      action:
        "Reduce CPU Workload",

      reason:
        "High CPU load"
    });
  }

  if(
    system.memoryUsage > 80
  ) {

    actions.push({

      action:
        "Optimize Memory Allocation",

      reason:
        "High memory usage"
    });
  }

  if(
    system.workflowConflicts > 0
  ) {

    actions.push({

      action:
        "Pause Conflicting Workflows",

      reason:
        "Workflow conflict detected"
    });
  }

  if(
    actions.length === 0
  ) {

    actions.push({

      action:
        "Maintain Stable Runtime",

      reason:
        "System stable"
    });
  }

  return {

    recursiveRuntime:
      true,

    actions
  };
}

module.exports = {
  monitorRuntime
};
