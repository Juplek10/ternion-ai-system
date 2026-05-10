const {
  analyzeSystem
} = require(
  "./core/self-improvement-engine"
);

const result =
  analyzeSystem();

console.log(
  JSON.stringify(
    result,
    null,
    2
  )
);
