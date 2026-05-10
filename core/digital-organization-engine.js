const fs =
  require("fs");

const file =

  "/root/ai-system/organization-departments.json";

function loadDepartments() {

  return JSON.parse(

    fs.readFileSync(
      file,
      "utf8"
    )
  );
}

function getOrganizationMap() {

  const data =
    loadDepartments();

  return data.departments;
}

function findDivision(
  keyword
) {

  const data =
    loadDepartments();

  const results = [];

  for(
    const department
    of data.departments
  ) {

    for(
      const division
      of department.divisions
    ) {

      if(
        division
        .toLowerCase()
        .includes(
          keyword
          .toLowerCase()
        )
      ) {

        results.push({

          department:
            department.name,

          division
        });
      }
    }
  }

  return results;
}

module.exports = {

  getOrganizationMap,

  findDivision
};
