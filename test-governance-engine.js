const {

  evaluateAction

} = require(

  "./core/autonomous-governance-engine"
);

const tests = [

  {
    action:
      "major-refactor",

    riskLevel: 5
  },

  {
    action:
      "delete-system-files",

    riskLevel: 10
  },

  {
    action:
      "restart-worker",

    riskLevel: 3
  }
];

for(
  const test
  of tests
) {

  console.log(

    JSON.stringify(

      evaluateAction(
        test
      ),

      null,

      2
    )
  );
}
