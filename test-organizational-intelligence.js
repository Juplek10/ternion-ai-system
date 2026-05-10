const {

  getLeadershipChain

} = require(

  "./core/organizational-intelligence"
);

const tests = [

  "Strategic Expert",

  "Risk Expert",

  "Architecture Expert"
];

for(
  const test
  of tests
) {

  console.log(

    "\nSPECIALIST:",

    test
  );

  console.log(

    JSON.stringify(

      getLeadershipChain(
        test
      ),

      null,

      2
    )
  );
}
