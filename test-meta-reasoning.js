const {

  evaluateStrategies

} = require(

  "./core/meta-reasoning-engine"
);

const result =

  evaluateStrategies([

    {
      name:
        "Vendor A Strategy",

      cost:
        40000000,

      risk: 7,

      timeline: 100,

      vendorStability: 5
    },

    {
      name:
        "Vendor B Strategy",

      cost:
        60000000,

      risk: 3,

      timeline: 110,

      vendorStability: 9
    },

    {
      name:
        "Hybrid Strategy",

      cost:
        50000000,

      risk: 4,

      timeline: 105,

      vendorStability: 8
    }
  ]);

console.log(
  JSON.stringify(
    result,
    null,
    2
  )
);
