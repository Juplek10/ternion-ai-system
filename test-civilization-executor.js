const {

  executeMission

} = require(

  "./core/civilization-executor-engine"
);

const objectives = [

  {
    objective:
      "Global Cognition Expansion"
  },

  {
    objective:
      "Predictive Autonomous Debugging"
  },

  {
    objective:
      "Continuous Experimentation Civilization"
  },

  {
    objective:
      "Stable Civilization"
  }
];

for(
  const objective
  of objectives
) {

  console.log(

    "\nOBJECTIVE:",

    objective.objective
  );

  console.log(

    JSON.stringify(

      executeMission(
        objective
      ),

      null,

      2
    )
  );
}
