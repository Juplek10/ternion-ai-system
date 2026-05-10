const axios =
  require("axios");

const cheerio =
  require("cheerio");

async function readWebsite(
  url
) {

  try {

    const response =
      await axios.get(
        url
      );

    const html =
      response.data;

    const $ =
      cheerio.load(
        html
      );

    const title =
      $("title")
      .text();

    const content =
      $("body")
      .text()
      .replace(/\s+/g, " ")
      .trim();

    return {

      success: true,

      url,

      title,

      content
    };

  } catch(err) {

    return {

      success: false,

      error:
        err.toString()
    };
  }
}

module.exports = {
  readWebsite
};
