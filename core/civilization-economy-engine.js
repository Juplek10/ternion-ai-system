const fs =
  require("fs");

const file =

  "/root/ai-system/civilization-economy.json";

function loadEconomy() {

  return JSON.parse(

    fs.readFileSync(
      file,
      "utf8"
    )
  );
}

function analyzeEconomy() {

  const data =
    loadEconomy();

  const scored = [];

  for(
    const org
    of data.organizations
  ) {

    const score =

      (
        org.efficiency *
        org.impact
      ) /

      org.budget;

    scored.push({

      ...org,

      economicScore:
        score.toFixed(2)
    });
  }

  scored.sort(

    (
      a,
      b
    ) =>

      b.economicScore -
      a.economicScore
  );

  return {

    strongestInvestment:
      scored[0],

    economyRanking:
      scored
  };
}

module.exports = {
  analyzeEconomy
};
