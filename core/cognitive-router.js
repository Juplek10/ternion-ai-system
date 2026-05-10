function selectReasoningMode(
  objective
) {

  const text =

    objective
    .toLowerCase();

  if(
    text.includes(
      "vendor"
    )
  ) {

    return {
      mode:
        "strategic-reasoning"
    };
  }

  if(
    text.includes(
      "rab"
    )
  ) {

    return {
      mode:
        "quantitative-reasoning"
    };
  }

  if(
    text.includes(
      "timeline"
    )
  ) {

    return {
      mode:
        "planning-reasoning"
    };
  }

  if(
    text.includes(
      "risk"
    )
  ) {

    return {
      mode:
        "risk-reasoning"
    };
  }

  if(
    text.includes(
      "architecture"
    )
  ) {

    return {
      mode:
        "architecture-reasoning"
    };
  }

  return {
    mode:
      "general-reasoning"
  };
}

module.exports = {
  selectReasoningMode
};
