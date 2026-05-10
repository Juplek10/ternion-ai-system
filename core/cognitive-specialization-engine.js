const specializations = {

  "strategic-reasoning": {

    expert:
      "Strategic Expert",

    capabilities: [

      "vendor-analysis",

      "business-strategy",

      "decision-analysis"
    ]
  },

  "quantitative-reasoning": {

    expert:
      "Quantitative Expert",

    capabilities: [

      "rab-calculation",

      "boq-analysis",

      "quantity-estimation"
    ]
  },

  "planning-reasoning": {

    expert:
      "Planning Expert",

    capabilities: [

      "timeline-planning",

      "workflow-design",

      "resource-planning"
    ]
  },

  "risk-reasoning": {

    expert:
      "Risk Expert",

    capabilities: [

      "risk-analysis",

      "safety-governance",

      "risk-mitigation"
    ]
  },

  "architecture-reasoning": {

    expert:
      "Architecture Expert",

    capabilities: [

      "system-design",

      "scalability-analysis",

      "optimization"
    ]
  },

  "general-reasoning": {

    expert:
      "General Expert",

    capabilities: [

      "general-analysis"
    ]
  }
};

function getSpecialist(
  mode
) {

  return (

    specializations[
      mode
    ] ||

    specializations[
      "general-reasoning"
    ]
  );
}

module.exports = {
  getSpecialist
};
