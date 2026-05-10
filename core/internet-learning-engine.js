const {

  learnKnowledge

} = require(

  "./construction-knowledge-engine"
);

const {

  readWebsite

} = require(

  "./web-reader"
);

async function learnFromInternet(
  url
) {

  const result =

    await readWebsite(
      url
    );

  if(
    !result.success
  ) {

    return result;
  }

  const content =
    result.content;

  const learned = [];

  const sentences =

    content.split(".");

  for(
    const sentence
    of sentences
  ) {

    const text =
      sentence.trim();

    if(
      text
      .toLowerCase()
      .includes(
        "vendor"
      )
    ) {

      learnKnowledge({

        type:
          "vendors",

        content:
          text
      });

      learned.push(
        text
      );
    }

    if(
      text
      .toLowerCase()
      .includes(
        "harga"
      )
    ) {

      learnKnowledge({

        type:
          "ahsp",

        content:
          text
      });

      learned.push(
        text
      );
    }

    if(
      text
      .toLowerCase()
      .includes(
        "risiko"
      )
    ) {

      learnKnowledge({

        type:
          "risks",

        content:
          text
      });

      learned.push(
        text
      );
    }
  }

  return {

    success: true,

    title:
      result.title,

    learnedCount:
      learned.length,

    learned
  };
}

module.exports = {
  learnFromInternet
};

