const {

  manageInfrastructure

} = require(

  "./core/infrastructure-management-engine"
);

const infrastructures = [

  {
    name:
      "High Load Server",

    serverLoad: 95,

    latency: 50,

    memoryInstability: false
  },

  {
    name:
      "Latency Critical",

    serverLoad: 40,

    latency: 150,

    memoryInstability: false
  },

  {
    name:
      "Memory Failure",

    serverLoad: 50,

    latency: 40,

    memoryInstability: true
  },

  {
    name:
      "Stable Infrastructure",

    serverLoad: 30,

    latency: 20,

    memoryInstability: false
  }
];

for(
  const infra
  of infrastructures
) {

  console.log(

    "\nINFRASTRUCTURE:",

    infra.name
  );

  console.log(

    JSON.stringify(

      manageInfrastructure(
        infra
      ),

      null,

      2
    )
  );
}
