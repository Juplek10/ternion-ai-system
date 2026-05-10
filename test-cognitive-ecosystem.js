const {

  buildCognitiveFlow

} = require(

  "./core/cognitive-ecosystem"
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

    JSON.stringify(

      buildCognitiveFlow(
        test
      ),

      null,

      2
    )
  );
}
