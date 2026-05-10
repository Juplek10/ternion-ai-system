const fs = require("fs-extra");

const VECTOR_FILE =
  "/root/ai-system/vector/memory.json";

async function loadVectors() {

  try {

    return await fs.readJson(
      VECTOR_FILE
    );

  } catch(err) {

    return [];
  }
}

async function saveVectors(
  vectors
) {

  await fs.writeJson(
    VECTOR_FILE,
    vectors,
    { spaces: 2 }
  );
}

function tokenize(text) {

  return text
    .toLowerCase()
    .split(/\W+/)
    .filter(Boolean);
}

async function addMemory(
  text,
  metadata = {}
) {

  const vectors =
    await loadVectors();

  const tokens =
    tokenize(text);

  vectors.push({

    id:
      Date.now(),

    text,

    tokens,

    metadata,

    createdAt:
      new Date().toISOString()
  });

  await saveVectors(
    vectors
  );

  return true;
}

async function searchMemory(
  query
) {

  const vectors =
    await loadVectors();

  const queryTokens =
    tokenize(query);

  const scored =
    vectors.map(item => {

      let score = 0;

      for(
        const token
        of queryTokens
      ) {

        if(
          item.tokens.includes(
            token
          )
        ) {

          score++;
        }
      }

      return {

        ...item,

        score
      };
    });

  return scored
    .filter(
      item =>
        item.score > 0
    )
    .sort(
      (a,b) =>
        b.score - a.score
    );
}

module.exports = {

  addMemory,

  searchMemory
};
