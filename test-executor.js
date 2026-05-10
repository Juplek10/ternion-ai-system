const executeTool =
  require("./core/tool-executor");

async function test() {

  await executeTool(
    "writeFile",
    {
      path:
        "sandbox/ai-note.md",

      content:
        "# AI Generated File"
    }
  );

  const content =
    await executeTool(
      "readFile",
      {
        path:
          "sandbox/ai-note.md"
      }
    );

  console.log(content);
}

test();
