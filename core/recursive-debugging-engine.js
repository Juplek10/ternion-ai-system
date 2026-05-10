function analyzeError(
  errorText
) {

  const fixes = [];

  const text =
    errorText
    .toLowerCase();

  if(
    text.includes(
      "is not a function"
    )
  ) {

    fixes.push({

      issue:
        "Function export problem",

      fix:
        "Check module.exports"
    });
  }

  if(
    text.includes(
      "cannot find module"
    )
  ) {

    fixes.push({

      issue:
        "Missing module",

      fix:
        "Check file existence or install dependency"
    });
  }

  if(
    text.includes(
      "syntaxerror"
    )
  ) {

    fixes.push({

      issue:
        "Syntax issue",

      fix:
        "Check brackets and commas"
    });
  }

  if(
    fixes.length === 0
  ) {

    fixes.push({

      issue:
        "Unknown error",

      fix:
        "Manual investigation required"
    });
  }

  return {

    analyzed: true,

    fixes
  };
}

module.exports = {
  analyzeError
};
