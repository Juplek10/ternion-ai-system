const {
  saveMemory,
  getMemories
} = require("./core/memory/memory");

async function test() {

  await saveMemory({
    type: "project",
    content: "AI system initialized"
  });

  const memories = await getMemories();

  console.log(memories);
}

test();
