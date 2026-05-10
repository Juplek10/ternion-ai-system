async function suggestPatch(
  analysis
) {

  const patches = [];

  for(const item of analysis) {

    if(
      item.cause ===
      "Possible syntax issue"
    ) {

      patches.push({

        type:
          "syntax-fix",

        action:
          "Inspect nearby code and fix syntax",

        safe: true
      });
    }

    else if(
      item.cause ===
      "Missing module"
    ) {

      patches.push({

        type:
          "module-fix",

        action:
          "Check require path or install dependency",

        safe: true
      });
    }

    else {

      patches.push({

        type:
          "manual-review",

        action:
          "Human inspection recommended",

        safe: false
      });
    }
  }

  return patches;
}

module.exports =
  suggestPatch;

