function parseBOQTable(
  text
) {

  const lines =
    text
      .split("\n")
      .map(
        line =>
          line.trim()
      )
      .filter(Boolean);

  const items = [];

  for(
    const line
    of lines
  ) {

    const parts =
      line
        .split("|")
        .map(
          p => p.trim()
        );

    if(
      parts.length >= 3
    ) {

      items.push({

        item:
          parts[0],

        volume:
          parseFloat(
            parts[1]
          ),

        unit:
          parts[2]
      });
    }
  }

  return items;
}

module.exports = {
  parseBOQTable
};
