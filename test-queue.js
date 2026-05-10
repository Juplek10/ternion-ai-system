const {
  addTask,
  getTasks
} = require("./core/queue");

async function test() {

  await addTask({
    type: "rab",
    prompt: "Generate RAB Gudang"
  });

  const tasks =
    await getTasks();

  console.log(tasks);
}

test();
