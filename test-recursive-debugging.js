const {

  analyzeError

} = require(

  "./core/recursive-debugging-engine"
);

const errors = [

  "TypeError: evolveIntelligence is not a function",

  "Error: Cannot find module './runtime-engine'",

  "SyntaxError: Unexpected token"
];

for(
  const error
  of errors
) {

  console.log(

    "\nERROR:",

    error
  );

  console.log(

    JSON.stringify(

      analyzeError(
        error
      ),

      null,

      2
    )
  );
}
