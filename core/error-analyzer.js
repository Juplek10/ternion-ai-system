async function analyzeErrors(
  errors
) {

  const analysis = [];

  for(const err of errors) {

    const lower =
      err.toLowerCase();

    if(
      lower.includes(
        "syntaxerror"
      )
    ) {

      analysis.push({

        error: err,

        cause:
          "Possible syntax issue",

        suggestion:
          "Check brackets, commas, or quotes"
      });
    }

    else if(
      lower.includes(
        "module_not_found"
      )
    ) {

      analysis.push({

        error: err,

        cause:
          "Missing module",

        suggestion:
          "Check require path or install dependency"
      });
    }

    else if(
      lower.includes(
        "unexpected token"
      )
    ) {

      analysis.push({

        error: err,

        cause:
          "Invalid JavaScript syntax",

        suggestion:
          "Inspect nearby code structure"
      });
    }

    else {

      analysis.push({

        error: err,

        cause:
          "Unknown",

        suggestion:
          "Manual inspection required"
      });
    }
  }

  return analysis;
}

module.exports =
  analyzeErrors;
