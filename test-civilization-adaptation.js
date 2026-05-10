const {

  adaptCivilization

} = require(

  "./core/civilization-adaptation-engine"
);

const scenarios = [

  {
    name:
      "Operations Collapse",

    researchGrowth: 5,

    governanceStrength: 6,

    operationsStability: 2
  },

  {
    name:
      "Research Dominance",

    researchGrowth: 10,

    governanceStrength: 4,

    operationsStability: 7
  },

  {
    name:
      "Balanced Civilization",

    researchGrowth: 7,

    governanceStrength: 9,

    operationsStability: 9
  }
];

for(
  const scenario
  of scenarios
) {

  console.log(

    "\nSCENARIO:",

    scenario.name
  );

  console.log(

    JSON.stringify(

      adaptCivilization(
        scenario
      ),

      null,

      2
    )
  );
}
