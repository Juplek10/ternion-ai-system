const {

  runCommand

} = require(

  "./core/execution-sandbox"
);

const tests = [

  "ls",

  "pwd",

  "node -v"
];

for(
  const cmd
  of tests
) {

  console.log(

    "\nCOMMAND:",

    cmd
  );

  console.log(

    JSON.stringify(

      runCommand(
        cmd
      ),

      null,

      2
    )
  );
}
