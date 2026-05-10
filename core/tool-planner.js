async function planTool(
  prompt
) {

  const lower =
    prompt.toLowerCase();

  if(
    lower.includes("markdown") ||
    lower.includes(".md")
  ) {

    let fileName =
      "generated";

    if(
      lower.includes("roadmap")
    ) {

      fileName =
        "roadmap";
    }

    if(
      lower.includes("vendor")
    ) {

      fileName =
        "vendor";
    }

    return {
      tool: "writeFile",

      params: {

        path:
          `sandbox/${fileName}.md`,

        content:
`# ${fileName.toUpperCase()}

Generated automatically by AI.

Task:
${prompt}
`
      }
    };
  }

  if(
    lower.includes("buat folder")
  ) {

    return {
      tool: "createFolder",

      params: {
        path:
          "sandbox/new-folder"
      }
    };
  }

  return null;
}

module.exports =
  planTool;
