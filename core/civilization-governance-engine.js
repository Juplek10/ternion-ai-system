const fs =
  require("fs");

const file =

  "/root/ai-system/civilization-policies.json";

function loadPolicies() {

  return JSON.parse(

    fs.readFileSync(
      file,
      "utf8"
    )
  );
}

function evaluateCivilizationAction({

  organization,

  action
}) {

  const data =
    loadPolicies();

  const policy =

    data.policies.find(

      p =>

        p.organization ===
        organization
    );

  if(
    !policy
  ) {

    return {

      allowed: true,

      approval: false
    };
  }

  if(
    policy.restrictedActions
    .includes(action)
  ) {

    return {

      allowed: false,

      reason:
        "Restricted civilization action"
    };
  }

  return {

    allowed: true,

    approval:
      policy.requiresApproval
  };
}

module.exports = {
  evaluateCivilizationAction
};
