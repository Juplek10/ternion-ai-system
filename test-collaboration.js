const {
  collaborate
} = require(
  "./core/collaboration-engine"
);

async function test() {

  const workflow = [

    {
      agent:
        "vendor-agent",

      input: {
        vendor:
          "PT Beton Maju"
      }
    },

    {
      agent:
        "pdf-agent",

      input: {
        file:
          "tender.pdf"
      }
    }
  ];

  const result =
    await collaborate(
      workflow
    );

  console.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );
}

test();
