const fsTools =
  require("../fs-tools");
const {
  registerAgent
} = require("../agents");

async function generateAgent(
  name
) {

  const folder =
    `agents/${name}`;

  const jsFile =
`${folder}/${name}.js`;

  const readmeFile =
`${folder}/README.md`;

  const configFile =
`${folder}/config.json`;

  await fsTools.createFolder(
    folder
  );

  await fsTools.writeFile(
    jsFile,

`module.exports = async function(input) {

  return {
    success: true,
    agent: "${name}",
    input
  };
};
`
  );

  await fsTools.writeFile(
    readmeFile,

`# ${name}

Generated automatically by AI.
`
  );

  await fsTools.writeFile(
    configFile,

JSON.stringify(
  {
    name,
    createdAt:
      new Date().toISOString(),
    type: "custom-agent"
  },
  null,
  2
)
  );

  await registerAgent({

  name,

  type:
    "generated-agent",

  skills: [
    "custom-task"
  ]
});

return {
  success: true,
  agent: name
};
}

module.exports =
  generateAgent;
