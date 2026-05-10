const fs =
  require("fs");

const path =
  require("path");

function scanJSFiles(
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

      scanJSFiles(
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

function extractDependencies(
  content
) {

  const regex =

    /require\(["'`](.*?)["'`]\)/g;

  const dependencies = [];

  let match;

  while(
    (
      match =
      regex.exec(
        content
      )
    ) !== null
  ) {

    dependencies.push(
      match[1]
    );
  }

  return dependencies;
}

function analyzeDependencies(
  baseDir
) {

  const files =
    scanJSFiles(
      baseDir
    );

  const graph = {};

  for(
    const file
    of files
  ) {

    const content =

      fs.readFileSync(
        file,
        "utf8"
      );

    const deps =

      extractDependencies(
        content
      );

    graph[file] = {
      dependencies: deps,
      dependencyCount:
        deps.length
    };
  }

  return graph;
}

module.exports = {
  analyzeDependencies
};
