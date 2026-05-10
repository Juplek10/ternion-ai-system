async function planWorkflow(
  prompt
) {

  const lower =
    prompt.toLowerCase();

  const workflow = [];

  if(
    lower.includes("vendor")
  ) {

    workflow.push({

      agent:
        "vendor-agent",

      input: {
        task: prompt
      }
    });
  }

  if(
    lower.includes("pdf") ||
    lower.includes("tender")
  ) {

    workflow.push({

      agent:
        "pdf-agent",

      input: {
        task: prompt
      }
    });
  }

  if(
    lower.includes("rab") ||
    lower.includes("boq")
  ) {

    workflow.push({

      agent:
        "rab-agent",

      input: {
        task: prompt
      }
    });
  }

  if(
    lower.includes("spreadsheet") ||
    lower.includes("excel")
  ) {

    workflow.push({

      agent:
        "spreadsheet-agent",

      input: {
        task: prompt
      }
    });
  }

  return workflow;
}

module.exports =
  planWorkflow;

