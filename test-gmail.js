const {
  getEmails
} = require("./core/integrations/gmail");

async function test() {

  const emails = await getEmails();

  console.log(emails);
}

test();
