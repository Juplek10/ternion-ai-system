const fs =
  require("fs");

const file =

  "/root/ai-system/meta-civilizations.json";

function loadCivilizations() {

  return JSON.parse(

    fs.readFileSync(
      file,
      "utf8"
    )
  );
}

function compareCivilizations() {

  const data =
    loadCivilizations();

  const ranked = [];

  for(
    const civ
    of data.civilizations
  ) {

    const score =

      (
        civ.stability * 2 +
        civ.innovation +
        civ.adaptability * 2
      );

    ranked.push({

      ...civ,

      metaScore:
        score
    });
  }

  ranked.sort(

    (
      a,
      b
    ) =>

      b.metaScore -
      a.metaScore
  );

  return {

    bestCivilization:
      ranked[0],

    rankings:
      ranked
  };
}

module.exports = {
  compareCivilizations
};
