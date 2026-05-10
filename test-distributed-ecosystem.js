const {

  coordinateNodes

} = require(

  "./core/distributed-ecosystem-engine"
);

const ecosystem = {

  nodes: [

    {
      name:
        "Node-A",

      load: 90,

      crashed: false,

      latency: 40
    },

    {
      name:
        "Node-B",

      load: 30,

      crashed: true,

      latency: 20
    },

    {
      name:
        "Node-C",

      load: 40,

      crashed: false,

      latency: 150
    },

    {
      name:
        "Node-D",

      load: 20,

      crashed: false,

      latency: 20
    }
  ]
};

console.log(

  JSON.stringify(

    coordinateNodes(
      ecosystem
    ),

    null,

    2
  )
);
