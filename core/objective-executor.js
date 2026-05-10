const {
  decomposeObjective
} = require(
  "./objective-planner"
);

const {
  collaborate
} = require(
  "./collaboration-engine"
);

async function executeObjective(
  objective
) {

  console.log(
    "\n===================="
  );

  console.log(
    "EXECUTING OBJECTIVE"
  );

  console.log(
    objective.title
  );

  console.log(
    "===================="
  );

  const tasks =
    await decomposeObjective(
      objective
    );

  const workflow =
    tasks.map(task => ({

      agent:
        task.agent,

      input: {
        task:
          task.title
      }
    }));

  const result =
    await collaborate(
      workflow
    );

  objective.tasks =
    tasks;

  objective.progress =
    100;

  objective.status =
    "completed";

  return {

    objective,

    workflow,

    result
  };
}

module.exports = {
  executeObjective
};
