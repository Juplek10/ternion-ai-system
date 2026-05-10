const {

  evaluateCivilizationAction

} = require(

  "./core/civilization-governance-engine"
);

const tests = [

  {
    organization:
      "Research Organization",

    action:
      "experimental cognition deployment"
  },

  {
    organization:
      "Operations Organization",

    action:
      "restart monitoring"
  },

  {
    organization:
      "Security Organization",

    action:
      "override governance authority"
  }
];

for(
  const test
  of tests
) {

  console.log(

    JSON.stringify(

      evaluateCivilizationAction(
        test
      ),

      null,

      2
    )
  );
}
