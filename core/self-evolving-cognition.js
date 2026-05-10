const fs =
  require("fs");

const file =

  "/root/ai-system/evolving-specialists.json";

function load() {

  return JSON.parse(

    fs.readFileSync(
      file,
      "utf8"
    )
  );
}

function save(
  data
) {

  fs.writeFileSync(

    file,

    JSON.stringify(
      data,
      null,
      2
    )
  );
}

function createSpecialist({

  name,

  capabilities,

  collaborators
}) {

  const data =
    load();

  data.specialists.push({

    name,

    capabilities,

    collaborators,

    createdAt:
      new Date()
      .toISOString()
  });

  save(data);

  return {

    success: true,

    specialist: name
  };
}

function evolveFromTask(
  task
) {

  const text =

    task
    .toLowerCase();

  if(
    text.includes(
      "cost"
    )
  ) {

    return createSpecialist({

      name:
        "Cost Optimization Expert",

      capabilities: [

        "cost-analysis",

        "budget-optimization",

        "resource-efficiency"
      ],

      collaborators: [

        "Strategic Expert",

        "Quantitative Expert"
      ]
    });
  }

  if(
    text.includes(
      "performance"
    )
  ) {

    return createSpecialist({

      name:
        "Performance Expert",

      capabilities: [

        "runtime-analysis",

        "performance-optimization",

        "latency-reduction"
      ],

      collaborators: [

        "Architecture Expert"
      ]
    });
  }

  return {

    success: false,

    reason:
      "No evolution pattern"
  };
}

module.exports = {

  createSpecialist,

  evolveFromTask
};
