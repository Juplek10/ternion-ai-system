async function decomposeObjective(
  objective
) {

  const tasks = [];

  if(
    objective.title
      .toLowerCase()
      .includes("rab")
  ) {

    tasks.push({

      title:
        "Buat PDF parser",

      agent:
        "pdf-agent"
    });

    tasks.push({

      title:
        "Buat BOQ engine",

      agent:
        "rab-agent"
    });

    tasks.push({

      title:
        "Buat spreadsheet exporter",

      agent:
        "spreadsheet-agent"
    });
  }

  return tasks;
}

module.exports = {
  decomposeObjective
};
