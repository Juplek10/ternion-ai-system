function findValue(
  text,
  label,
  nextLabels = []
) {

  const lower =
    text.toLowerCase();

  const start =
    lower.indexOf(
      label.toLowerCase()
    );

  if(start === -1)
    return null;

  let end =
    text.length;

  for(
    const nextLabel
    of nextLabels
  ) {

    const idx =
      lower.indexOf(
        nextLabel.toLowerCase(),
        start + label.length
      );

    if(
      idx !== -1 &&
      idx < end
    ) {

      end = idx;
    }
  }

  return text
    .substring(
      start + label.length,
      end
    )
    .replace(/[:\n]/g," ")
    .trim();
}

function extractWorkItems(
  text
) {

  const items = [];

  const matches =
    text.match(
      /-\s([A-Za-z ]+)/g
    );

  if(matches) {

    for(
      const match
      of matches
    ) {

      items.push(

        match
          .replace("-","")
          .trim()
      );
    }
  }

  return items;
}

function extractKnowledge(
  text
) {

  const projectName =
    findValue(

      text,

      "Nama Proyek",

      [
        "Lokasi",
        "Lingkup",
        "Vendor"
      ]
    );

  const location =
    findValue(

      text,

      "Lokasi",

      [
        "Lingkup",
        "Vendor",
        "Estimasi"
      ]
    );

  const vendor =
    findValue(

      text,

      "Vendor Beton",

      [
        "Estimasi",
        "Durasi"
      ]
    );

  const estimatedValue =
    findValue(

      text,

      "Estimasi Nilai",

      [
        "Durasi"
      ]
    );

  return {

    projectName,

    location,

    vendor,

    estimatedValue,

    workItems:
      extractWorkItems(
        text
      )
  };
}

module.exports = {
  extractKnowledge
};
