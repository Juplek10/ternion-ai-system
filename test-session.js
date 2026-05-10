const {
  addMessage,
  loadSession
} = require("./core/session");

async function test() {

  await addMessage(
    "123",
    "user",
    "Halo AI"
  );

  await addMessage(
    "123",
    "assistant",
    "Halo Brian"
  );

  const session =
    await loadSession("123");

  console.log(session);
}

test();
