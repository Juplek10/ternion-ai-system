const fs =
  require("fs");

const path =
  require("path");

function scanDirectory(
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

      scanDirectory(
        fullPath,
        result
      );

    } else {

      result.push({

        name: file,

        path: fullPath,

        size:
          stat.size
      });
    }
  }

  return result;
}

function analyzeCodebase(
  baseDir
) {

  const files =
    scanDirectory(
      baseDir
    );

  const summary = {

    totalFiles:
      files.length,

    jsFiles: 0,

    mdFiles: 0,

    jsonFiles: 0,

    folders: {},

    largestFiles: []
  };

  for(
    const file
    of files
  ) {

    if(
      file.name.endsWith(
        ".js"
      )
    ) {

      summary.jsFiles++;
    }

    if(
      file.name.endsWith(
        ".md"
      )
    ) {

      summary.mdFiles++;
    }

    if(
      file.name.endsWith(
        ".json"
      )
    ) {

      summary.jsonFiles++;
    }

    const folder =
      path.dirname(
        file.path
      );

    if(
      !summary.folders[
        folder
      ]
    ) {

      summary.folders[
        folder
      ] = 0;
    }

    summary.folders[
      folder
    ]++;
  }

  summary.largestFiles =

    files
      .sort(
        (
          a,
          b
        ) =>

          b.size -
          a.size
      )
      .slice(0, 10);

  return summary;
}

module.exports = {
  analyzeCodebase
};

