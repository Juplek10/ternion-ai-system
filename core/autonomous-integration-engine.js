const fs =
  require("fs");

const path =
  require("path");

function registerWorkflow(
  workflowName
) {

  const workflowFile =

    "/root/ai-system/workflows.json";

  let workflows = [];

  if(
    fs.existsSync(
      workflowFile
    )
  ) {

    workflows =
      JSON.parse(

        fs.readFileSync(
          workflowFile,
          "utf8"
        )
      );
  }

  if(
    !workflows.includes(
      workflowName
    )
  ) {

    workflows.push(
      workflowName
    );

    fs.writeFileSync(

      workflowFile,

      JSON.stringify(
        workflows,
        null,
        2
      )
    );
  }

  return workflowName;
}

function registerModule(
  moduleName
) {

  const registryFile =

    "/root/ai-system/modules.json";

  let modules = [];

  if(
    fs.existsSync(
      registryFile
    )
  ) {

    modules =
      JSON.parse(

        fs.readFileSync(
          registryFile,
          "utf8"
        )
      );
  }

  if(
    !modules.includes(
      moduleName
    )
  ) {

    modules.push(
      moduleName
    );

    fs.writeFileSync(

      registryFile,

      JSON.stringify(
        modules,
        null,
        2
      )
    );
  }

  return moduleName;
}

function integrateFeature(
  plan
) {

  const result = {

    workflows: [],

    modules: []
  };

  for(
    const workflow
    of plan.workflows
  ) {

    result.workflows.push(

      registerWorkflow(
        workflow
      )
    );
  }

  for(
    const module
    of plan.requiredModules
  ) {

    result.modules.push(

      registerModule(
        module
      )
    );
  }

  return result;
}

module.exports = {
  integrateFeature
};

