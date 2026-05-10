const {

  monitorRuntime

} = require(

  "./core/recursive-operating-system"
);

const runtimes = [

  {
    name:
      "Overloaded Runtime",

    cpuLoad: 90,

    memoryUsage: 85,

    workflowConflicts: 2
  },

  {
    name:
      "Memory Pressure Runtime",

    cpuLoad: 40,

    memoryUsage: 90,

    workflowConflicts: 0
  },

  {
    name:
      "Stable Runtime",

    cpuLoad: 30,

    memoryUsage: 40,

    workflowConflicts: 0
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

      monitorRuntime(
        runtime
      ),

      null,

      2
    )
  );
}
