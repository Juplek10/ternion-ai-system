const {

  governanceDecision

} = require(

  "./core/autonomous-governance-engine"
);

const tests = [

  "create monitoring agent",

  "delete governance system",

  "shutdown runtime"
];

for(
  const test
  of tests
) {

  console.log(

    "\nCHANGE:",

    test
  );

  console.log(

    JSON.stringify(

      governanceDecision(
        test
      ),

      null,

      2
    )
  );
}
