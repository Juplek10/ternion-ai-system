const fs =
  require("fs");

const KNOWLEDGE_PATH =

  "/root/ai-system/memory/construction-knowledge.json";

function loadKnowledge() {

  if(
    !fs.existsSync(
      KNOWLEDGE_PATH
    )
  ) {

    return {
      terms: [],
      vendors: [],
      ahsp: [],
      risks: [],
      workflows: []
    };
  }

  return JSON.parse(

    fs.readFileSync(
      KNOWLEDGE_PATH,
      "utf8"
    )
  );
}

function saveKnowledge(
  data
) {

  fs.writeFileSync(

    KNOWLEDGE_PATH,

    JSON.stringify(
      data,
      null,
      2
    )
  );
}

function learnKnowledge({

  type,

  content
}) {

  const db =
    loadKnowledge();

  if(
    !db[type]
  ) {

    db[type] = [];
  }

  db[type].push({

    content,

    createdAt:
      new Date()
        .toISOString()
  });

  saveKnowledge(
    db
  );

  return {

    success: true,

    type,

    content
  };
}

function searchKnowledge(
  keyword
) {

  const db =
    loadKnowledge();

  const results = [];

  for(
    const key
    of Object.keys(db)
  ) {

    for(
      const item
      of db[key]
    ) {

      if(

        JSON.stringify(item)
        .toLowerCase()
        .includes(
          keyword
            .toLowerCase()
        )

      ) {

        results.push({

          category:
            key,

          item
        });
      }
    }
  }

  return results;
}

module.exports = {

  learnKnowledge,

  searchKnowledge,

  loadKnowledge
};
