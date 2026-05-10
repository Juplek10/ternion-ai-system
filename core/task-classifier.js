async function classifyTask(
  prompt
) {

  const lower =
    prompt.toLowerCase();

  const result = {

    category:
      "general",

    priority:
      "normal",

    approval:
      false,

    suggestedAgent:
      null
  };

  if(
    lower.includes("vendor")
  ) {

    result.category =
      "vendor";

    result.suggestedAgent =
      "vendor-agent";
  }

  if(
    lower.includes("error") ||
    lower.includes("fix") ||
    lower.includes("patch")
  ) {

    result.category =
      "system-maintenance";

    result.priority =
      "high";

    result.approval =
      true;
  }

  if(
    lower.includes("delete") ||
    lower.includes("restart")
  ) {

    result.approval =
      true;
  }

  if(
    lower.includes("rab") ||
    lower.includes("boq")
  ) {

    result.category =
      "construction";

    result.priority =
      "high";
  }

  return result;
}

module.exports =
  classifyTask;
