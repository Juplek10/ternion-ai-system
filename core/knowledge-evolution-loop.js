const fs =
  require("fs");

const path =
  require("path");

const {

  learnKnowledge

} = require(

  "./construction-knowledge-engine"
);

function evolveKnowledge() {

  const docsDir =

    "/root/ai-system/docs";

  if(
    !fs.existsSync(
      docsDir
    )
  ) {

    return {

      success: false,

      error:
        "Docs folder missing"
    };
  }

  const files =
    fs.readdirSync(
      docsDir
    );

  const learned = [];

  for(
    const file
    of files
  ) {

    const fullPath =

      path.join(
        docsDir,
        file
      );

    if(
      file.endsWith(
        ".txt"
      )
    ) {

      const content =

        fs.readFileSync(
          fullPath,
          "utf8"
        );

      const lines =
        content
          .split("\n");

      for(
        const line
        of lines
      ) {

        if(
          line
          .toLowerCase()
          .includes(
            "vendor"
          )
        ) {

          learnKnowledge({

            type:
              "vendors",

            content:
              line
          });

          learned.push(
            line
          );
        }

        if(
          line
          .toLowerCase()
          .includes(
            "risiko"
          )
        ) {

          learnKnowledge({

            type:
              "risks",

            content:
              line
          });

          learned.push(
            line
          );
        }

        if(
          line
          .toLowerCase()
          .includes(
            "ahsp"
          )
        ) {

          learnKnowledge({

            type:
              "ahsp",

            content:
              line
          });

          learned.push(
            line
          );
        }
      }
    }
  }

  return {

    success: true,

    learnedCount:
      learned.length,

    learned
  };
}

module.exports = {
  evolveKnowledge
};
