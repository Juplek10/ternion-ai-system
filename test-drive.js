const {
  listFiles
} = require("./core/integrations/drive");

async function test() {

  const files = await listFiles();

  console.log(files);
}

test();




