const {

  applyFix

} = require(

  "./core/self-healing-engine"
);

const issues = [

  "Function export problem",

  "Missing module",

  "Syntax issue",

  "Unknown crash"
];

for(
  const issue
  of issues
) {

  console.log(

    "\nISSUE:",

    issue
  );

  console.log(

    JSON.stringify(

      applyFix(
        issue
      ),

      null,

      2
    )
  );
}
