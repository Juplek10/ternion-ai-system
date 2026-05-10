const fs =
  require("fs");

const memoryFile =

  "/root/ai-system/strategic-memory.json";

function loadMemory() {

  if(
    !fs.existsSync(
      memoryFile
    )
  ) {

    return {

      roadmap: [],

      completed: [],

      priorities: [],

      longTermGoals: []
    };
  }

  return JSON.parse(

    fs.readFileSync(
      memoryFile,
      "utf8"
    )
  );
}

function saveMemory(
  memory
) {

  fs.writeFileSync(

    memoryFile,

    JSON.stringify(
      memory,
      null,
      2
    )
  );
}

function addGoal(
  goal,
  priority =
    "medium"
) {

  const memory =
    loadMemory();

  memory.roadmap.push({
    goal,
    priority,
    createdAt:
      new Date()
      .toISOString()
  });

  saveMemory(
    memory
  );

  return memory;
}

function completeGoal(
  goal
) {

  const memory =
    loadMemory();

  memory.completed.push({
    goal,
    completedAt:
      new Date()
      .toISOString()
  });

  memory.roadmap =

    memory.roadmap.filter(

      item =>

        item.goal !==
        goal
    );

  saveMemory(
    memory
  );

  return memory;
}

function getRoadmap() {

  return loadMemory();
}

module.exports = {

  addGoal,

  completeGoal,

  getRoadmap
};
