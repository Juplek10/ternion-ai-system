const recallMemory =
  require(
    "./memory-recall"
  );

const classifyTask =
  require(
    "./task-classifier"
  );

const {
  searchMemory
} = require(
  "./vector-memory"
);

function analyzeSemanticSources(
  semanticMemory
) {

  const analysis = {

    vendorKnowledge: false,

    projectKnowledge: false,

    internetKnowledge: false,

    constructionKnowledge: false,

    insights: []
  };

  for(
    const item
    of semanticMemory
  ) {

    const text =
      item.text
        .toLowerCase();

    const source =
      item.metadata
        ?.source || "";

    if(
      text.includes(
        "vendor"
      )
    ) {

      analysis.vendorKnowledge =
        true;

      analysis.insights.push(

        "Vendor experience available"
      );
    }

    if(
      text.includes(
        "proyek"
      )
    ) {

      analysis.projectKnowledge =
        true;

      analysis.insights.push(

        "Project history available"
      );
    }

    if(
      source.startsWith(
        "http"
      )
    ) {

      analysis.internetKnowledge =
        true;

      analysis.insights.push(

        "Internet intelligence available"
      );
    }

    if(
      text.includes(
        "beton"
      ) ||

      text.includes(
        "baja"
      ) ||

      text.includes(
        "struktur"
      )
    ) {

      analysis.constructionKnowledge =
        true;

      analysis.insights.push(

        "Construction expertise available"
      );
    }
  }

  analysis.insights =
    [...new Set(
      analysis.insights
    )];

  return analysis;
}

async function buildReasoningContext(
  prompt
) {

  const classification =
    await classifyTask(
      prompt
    );

  const memory =
    await recallMemory(
      prompt
    );

  const semanticMemory =
    await searchMemory(
      prompt
    );

  const semanticAnalysis =
    analyzeSemanticSources(
      semanticMemory
    );

  return {

    prompt,

    classification,

    memory,

    semanticMemory:
      semanticMemory.slice(0,5),

    semanticAnalysis,

    reasoningHints: [

      "Use historical knowledge",

      "Use document intelligence",

      "Use internet intelligence",

      "Use semantic experience",

      "Use strategic reasoning",

      "Use relevant capabilities",

      "Consider previous workflows"
    ]
  };
}

module.exports = {
  buildReasoningContext
};
