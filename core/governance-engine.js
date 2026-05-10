async function evaluateRisk(
  workflow
) {

  const prompt =
    workflow.orchestration
      .prompt
      .toLowerCase();

  const result = {

    risky: false,

    level:
      "low",

    reasons: []
  };

  if(
    prompt.includes("restart")
  ) {

    result.risky =
      true;

    result.level =
      "medium";

    result.reasons.push(
      "Service restart detected"
    );
  }

  if(
    prompt.includes("delete")
  ) {

    result.risky =
      true;

    result.level =
      "high";

    result.reasons.push(
      "Delete action detected"
    );
  }

  if(
    prompt.includes("edit")
  ) {

    result.risky =
      true;

    result.level =
      "medium";

    result.reasons.push(
      "System edit detected"
    );
  }

  return result;
}

module.exports = {
  evaluateRisk
};
