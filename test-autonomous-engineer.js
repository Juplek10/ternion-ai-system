const {
  buildCapability
} = require(
  "./core/autonomous-engineer"
);

const result =
  buildCapability(

    "Timeline Risk Engine"
  );

console.log(
  JSON.stringify(
    result,
    null,
    2
  )
);
