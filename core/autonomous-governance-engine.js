function validateChange(
  change
) {

  const risks = [];

  if(
    change
    .includes(
      "delete"
    )
  ) {

    risks.push(
      "Dangerous deletion detected"
    );
  }

  if(
    change
    .includes(
      "shutdown"
    )
  ) {

    risks.push(
      "Critical shutdown action"
    );
  }

  return {

    approved:
      risks.length === 0,

    risks
  };
}

function governanceDecision(
  change
) {

  const validation =

    validateChange(
      change
    );

  if(
    !validation.approved
  ) {

    return {

      allowed: false,

      action:
        "BLOCK_CHANGE",

      validation
    };
  }

  return {

    allowed: true,

    action:
      "APPROVE_CHANGE",

    validation
  };
}

module.exports = {
  governanceDecision
};
