const {
  createFolder
} = require("./core/integrations/drive");

async function test() {

  const result =
    await createFolder(
      "AI Construction Projects"
    );

  console.log(result);
}

test();

