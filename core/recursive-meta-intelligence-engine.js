const fs =
  require("fs");

const file =

  "/root/ai-system/meta-intelligence-models.json";

function loadModels() {

  return JSON.parse(

    fs.readFileSync(
      file,
      "utf8"
    )
  );
}

function evolveIntelligence() {

  const data =
    loadModels();

  const ranked = [];

  for(
    const model
    of data.models
  ) {

    const score =

      (
        model.adaptability * 2 +
        model.stability +
        model.innovation * 2
      );

    ranked.push({

      ...model,

      intelligenceScore:
        score
    });
  }

  ranked.sort(

    (
      a,
      b
    ) =>

      b.intelligenceScore -
      a.intelligenceScore
  );

  return {

    optimalIntelligence:
      ranked[0],

    rankings:
      ranked
  };
}

module.exports = {
  evolveIntelligence
};
