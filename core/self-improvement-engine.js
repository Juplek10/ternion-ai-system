const fs =
  require("fs");

function analyzeSystem() {

  const insights = [];

  const improvements = [];

  const coreFiles =
    fs.readdirSync(
      "/root/ai-system/core"
    );

  if(
    !coreFiles.includes(
      "timeline-risk-engine.js"
    )
  ) {

    insights.push(
      "Timeline analysis missing"
    );

    improvements.push({

      type:
        "missing-capability",

      capability:
        "Timeline Risk Engine"
    });
  }

  if(
    !coreFiles.includes(
      "vendor-risk-engine.js"
    )
  ) {

    insights.push(
      "Vendor risk analysis missing"
    );

    improvements.push({

      type:
        "missing-capability",

      capability:
        "Vendor Risk Engine"
    });
  }

  return {

    success: true,

    insights,

    improvements
  };
}

module.exports = {
  analyzeSystem
};
