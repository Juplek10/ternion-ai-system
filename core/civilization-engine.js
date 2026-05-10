const fs =
  require("fs");

const file =

  "/root/ai-system/civilization-organizations.json";

function loadCivilization() {

  return JSON.parse(

    fs.readFileSync(
      file,
      "utf8"
    )
  );
}

function getOrganizations() {

  return loadCivilization()
    .organizations;
}

function findOrganizationByFocus(
  keyword
) {

  const data =
    loadCivilization();

  const results = [];

  for(
    const org
    of data.organizations
  ) {

    for(
      const focus
      of org.focus
    ) {

      if(
        focus.includes(
          keyword
          .toLowerCase()
        )
      ) {

        results.push({

          organization:
            org.name,

          focus
        });
      }
    }
  }

  return results;
}

module.exports = {

  getOrganizations,

  findOrganizationByFocus
};
