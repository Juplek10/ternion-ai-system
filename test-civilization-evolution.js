const {

  evolveCivilization

} = require(

  "./core/civilization-evolution-engine"
);

const tests = [

  "Need stronger security systems",

  "Expand research intelligence"
];

for(
  const test
  of tests
) {

  console.log(

    evolveCivilization(
      test
    )
  );
}
