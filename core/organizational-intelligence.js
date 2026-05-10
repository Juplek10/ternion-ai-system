const fs =
  require("fs");

const file =

  "/root/ai-system/organizational-structure.json";

function loadStructure() {

  return JSON.parse(

    fs.readFileSync(
      file,
      "utf8"
    )
  );
}

function getLeadershipChain(
  specialist
) {

  const structure =
    loadStructure();

  const chain = [];

  if(
    structure.executive
    .manages.includes(
      specialist
    )
  ) {

    chain.push({

      role:
        structure.executive
        .name,

      authority:

        structure.executive
        .authorityLevel
    });
  }

  for(
    const leader
    of structure.leaders
  ) {

    if(
      leader.manages
      .includes(
        specialist
      )
    ) {

      chain.push({

        role:
          leader.name,

        authority:
          leader.authorityLevel
      });
    }
  }

  return chain;
}

module.exports = {
  getLeadershipChain
};
