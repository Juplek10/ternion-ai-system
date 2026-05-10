const {

  coordinateFederation

} = require(

  "./core/civilization-network-engine"
);

const federation = {

  civilizations: [

    {
      name:
        "Federation-A",

      overloaded: true,

      conflict: false,

      latency: 40
    },

    {
      name:
        "Federation-B",

      overloaded: false,

      conflict: true,

      latency: 20
    },

    {
      name:
        "Federation-C",

      overloaded: false,

      conflict: false,

      latency: 150
    },

    {
      name:
        "Federation-D",

      overloaded: false,

      conflict: false,

      latency: 20
    }
  ]
};

console.log(

  JSON.stringify(

    coordinateFederation(
      federation
    ),

    null,

    2
  )
);
