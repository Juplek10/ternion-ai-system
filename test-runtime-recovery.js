const {

  recoverRuntime

} = require(

  "./core/runtime-recovery-engine"
);

const runtimes = [

  {
    name:
      "Worker Failure",

    workerDown: true,

    memoryLeak: false,

    runtimeFreeze: false
  },

  {
    name:
      "Memory Leak",

    workerDown: false,

    memoryLeak: true,

    runtimeFreeze: false
  },

  {
    name:
      "Frozen Runtime",

    workerDown: false,

    memoryLeak: false,

    runtimeFreeze: true
  },

  {
    name:
      "Healthy Runtime",

    workerDown: false,

    memoryLeak: false,

    runtimeFreeze: false
  }
];

for(
  const runtime
  of runtimes
) {

  console.log(

    "\nRUNTIME:",

    runtime.name
  );

  console.log(

    JSON.stringify(

      recoverRuntime(
        runtime
      ),

      null,

      2
    )
  );
}
