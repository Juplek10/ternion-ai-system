const {
  analyzeSystem
} = require(
  "./self-improvement-engine"
);

const {
  buildCapability
} = require(
  "./autonomous-engineer"
);

function runAutoImprovement() {

  const analysis =
    analyzeSystem();

  const built = [];

  for(
    const improvement
    of analysis.improvements
  ) {

    if(
      improvement.type ===
      "missing-capability"
    ) {

      console.log(
        "\nBUILDING:\n",
        improvement.capability
      );

      const result =
        buildCapability(

          improvement.capability
        );

      built.push(
        result
      );
    }
  }

  return {

    success: true,

    analysis,

    built
  };
}

module.exports = {
  runAutoImprovement
};
