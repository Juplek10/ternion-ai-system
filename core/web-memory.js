const {
  readWebPage
} = require(
  "./web-reader"
);

const {
  addMemory
} = require(
  "./vector-memory"
);

async function learnWebsite(
  url
) {

  const page =
    await readWebPage(
      url
    );

  if(!page.success) {

    return page;
  }

  const chunks = [];

  const content =
    page.content;

  for(
    let i = 0;
    i < content.length;
    i += 500
  ) {

    chunks.push(

      content.substring(
        i,
        i + 500
      )
    );
  }

  for(
    const chunk
    of chunks
  ) {

    await addMemory(

      chunk,

      {
        source:
          url,

        title:
          page.title
      }
    );
  }

  return {

    success: true,

    title:
      page.title,

    chunksSaved:
      chunks.length
  };
}

module.exports = {
  learnWebsite
};
