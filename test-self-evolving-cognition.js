const {

  evolveFromTask

} = require(

  "./core/self-evolving-cognition"
);

const tests = [

  "Need better cost management",

  "Improve performance optimization"
];

for(
  const test
  of tests
) {

  console.log(

    evolveFromTask(
      test
    )
  );
}
