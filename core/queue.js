const fs = require("fs-extra");

const TASK_FILE =
  "/root/ai-system/queue/tasks.json";

async function addTask(task) {

  let tasks = [];

  try {

    tasks = await fs.readJson(TASK_FILE);

  } catch(err) {

    tasks = [];

  }

  tasks.push({
    id: Date.now(),
    status: "pending",
    createdAt: new Date().toISOString(),
    ...task
  });

  await fs.writeJson(
    TASK_FILE,
    tasks,
    { spaces: 2 }
  );

  return true;
}

async function getTasks() {

  try {

    return await fs.readJson(TASK_FILE);

  } catch(err) {

    return [];

  }
}

async function updateTask(id, data) {

  let tasks =
    await getTasks();

  tasks = tasks.map(task => {

    if(task.id === id) {
      return {
        ...task,
        ...data
      };
    }

    return task;
  });

  await fs.writeJson(
    TASK_FILE,
    tasks,
    { spaces: 2 }
  );
}

module.exports = {
  addTask,
  getTasks,
  updateTask
};
