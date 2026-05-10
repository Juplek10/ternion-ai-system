const fs =
  require("fs");

const path =
  require("path");

function scanFiles(
  dir,
  result = []
) {

  const files =
    fs.readdirSync(
      dir
    );

  for(
    const file
    of files
  ) {

    const fullPath =

      path.join(
        dir,
        file
      );

    const stat =

      fs.statSync(
        fullPath
      );

    if(
      stat.isDirectory()
    ) {

      scanFiles(
        fullPath,
        result
      );

    } else if(
      file.endsWith(
        ".js"
      )
    ) {

      result.push(
        fullPath
      );
    }
  }

  return result;
}

function optimizeSystem(
  baseDir
) {

  const files =

    scanFiles(
      baseDir
    );

  const suggestions = [];

  for(
    const file
    of files
  ) {

    const content =

      fs.readFileSync(
        file,
        "utf8"
      );

    const lines =

      content.split(
        "\n"
      ).length;

    if(
      lines > 300
    ) {

      suggestions.push({

        type:
          "large-module",

        file,

        recommendation:
          "Split module into smaller components"
      });
    }

    if(
      content.includes(
        "console.log"
      )
    ) {

      suggestions.push({

        type:
          "debug-code",

        file,

        recommendation:
          "Remove debug logging"
      });
    }

    if(
      content.includes(
        "TODO"
      )
    ) {

      suggestions.push({

        type:
          "unfinished-work",

        file,

        recommendation:
          "Complete pending TODO items"
      });
    }
  }

  return {

    success: true,

    analyzedFiles:
      files.length,

    suggestions
  };
}

module.exports = {
  optimizeSystem
};
