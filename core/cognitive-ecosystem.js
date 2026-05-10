const ecosystem = {

  "Strategic Expert": {

    collaboratesWith: [

      "Risk Expert",

      "Quantitative Expert"
    ]
  },

  "Risk Expert": {

    collaboratesWith: [

      "Governance Expert",

      "Strategic Expert"
    ]
  },

  "Quantitative Expert": {

    collaboratesWith: [

      "Planning Expert",

      "Strategic Expert"
    ]
  },

  "Planning Expert": {

    collaboratesWith: [

      "Quantitative Expert"
    ]
  },

  "Architecture Expert": {

    collaboratesWith: [

      "Governance Expert"
    ]
  },

  "Governance Expert": {

    collaboratesWith: [

      "Risk Expert",

      "Architecture Expert"
    ]
  }
};

function buildCognitiveFlow(
  specialist
) {

  const node =

    ecosystem[
      specialist
    ];

  if(
    !node
  ) {

    return {
      specialist,
      collaborators: []
    };
  }

  return {

    specialist,

    collaborators:

      node
      .collaboratesWith
  };
}

module.exports = {
  buildCognitiveFlow
};
