const {

  evolveKnowledge

} = require(

  "./knowledge-evolution-loop"
);

const {

  runAutoImprovement

} = require(

  "./auto-improvement-loop"
);

async function runLoop() {

  console.log(

    "\n===================="
  );

  console.log(
    "AUTONOMOUS LOOP ACTIVE"
  );

  console.log(
    new Date()
      .toISOString()
  );

  console.log(
    "====================\n"
  );

  try {

    const learning =

      evolveKnowledge();

    console.log(
      "\nLEARNING RESULT\n"
    );

    console.log(
      JSON.stringify(
        learning,
        null,
        2
      )
    );

    const improvement =

      runAutoImprovement();

    console.log(
      "\nIMPROVEMENT RESULT\n"
    );

    console.log(
      JSON.stringify(
        improvement,
        null,
        2
      )
    );

  } catch(err) {

    console.log(
      "\nLOOP ERROR\n"
    );

    console.log(
      err
    );
  }
}

setInterval(

  runLoop,

  1000 * 60

);

runLoop();
