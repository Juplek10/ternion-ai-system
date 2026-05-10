const {

  evolveSystem

} = require(

  "./core/self-evolution-loop"
);

async function test() {

  const result =

    await evolveSystem({

      totalModules: 2,

      workflows: 1,

      tests: 3,

      agents: 2,

      integrations: 1
    });

  console.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );
}

test();
