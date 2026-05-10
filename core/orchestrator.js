const classifyTask =
  require(
    "./task-classifier"
  );

const detectGap =
  require(
    "./capability-gap"
  );

async function orchestrate(
  prompt
) {

  const classification =
    await classifyTask(
      prompt
    );

  const gap =
    await detectGap(
      prompt
    );

  return {

    prompt,

    classification,

    capabilityGap:
      gap,

    nextAction:

      gap.hasCapability

      ? "execute"

      : "build-capability"
  };
}

module.exports =
  orchestrate;
