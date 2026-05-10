const fs =
  require("fs");

const file =

  "/root/ai-system/civilization-strategy.json";

function loadStrategy() {

  return JSON.parse(

    fs.readFileSync(
      file,
      "utf8"
    )
  );
}

function getAlliances() {

  return loadStrategy()
    .alliances;
}

function findAlliance(
  organization
) {

  const data =
    loadStrategy();

  return data.alliances.filter(

    a =>

      a.from ===
      organization ||

      a.to ===
      organization
  );
}

module.exports = {

  getAlliances,

  findAlliance
};
