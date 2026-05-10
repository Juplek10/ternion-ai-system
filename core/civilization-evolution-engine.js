const fs =
  require("fs");

const file =

  "/root/ai-system/evolving-civilizations.json";

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

function createOrganization({

  name,

  focus,

  alliance
}) {

  const data =
    load();

  data.organizations.push({

    name,

    focus,

    alliance,

    createdAt:
      new Date()
      .toISOString()
  });

  save(data);

  return {

    success: true,

    organization:
      name
  };
}

function evolveCivilization(
  signal
) {

  const text =

    signal
    .toLowerCase();

  if(
    text.includes(
      "security"
    )
  ) {

    return createOrganization({

      name:
        "Security Organization",

      focus: [

        "threat detection",

        "security governance",

        "intrusion prevention"
      ],

      alliance: [

        "Governance Organization",

        "Operations Organization"
      ]
    });
  }

  if(
    text.includes(
      "research"
    )
  ) {

    return createOrganization({

      name:
        "Advanced Research Organization",

      focus: [

        "recursive cognition",

        "experimental intelligence",

        "advanced reasoning"
      ],

      alliance: [

        "Research Organization"
      ]
    });
  }

  return {

    success: false,

    reason:
      "No civilization evolution pattern"
  };
}

module.exports = {

  evolveCivilization,

  createOrganization
};
