const {

  redesignCivilization

} = require(

  "./core/recursive-civilization-engine"
);

const civilizations = [

  {
    name:
      "Centralized Civilization",

    governanceModel:
      "centralized",

    operationsLoad: 9,

    researchDominance: 5
  },

  {
    name:
      "Research Heavy Civilization",

    governanceModel:
      "balanced",

    operationsLoad: 5,

    researchDominance: 10
  },

  {
    name:
      "Optimized Civilization",

    governanceModel:
      "balanced",

    operationsLoad: 4,

    researchDominance: 4
  }
];

for(
  const civ
  of civilizations
) {

  console.log(

    "\nCIVILIZATION:",

    civ.name
  );

  console.log(

    JSON.stringify(

      redesignCivilization(
        civ
      ),

      null,

      2
    )
  );
}
