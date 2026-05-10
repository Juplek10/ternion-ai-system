const fs = require("fs-extra");

const SESSION_DIR =
  "/root/ai-system/sessions";

async function loadSession(chatId) {

  const file =
    `${SESSION_DIR}/${chatId}.json`;

  try {

    return await fs.readJson(file);

  } catch(err) {

    return {
      history: []
    };
  }
}

async function saveSession(
  chatId,
  data
) {

  const file =
    `${SESSION_DIR}/${chatId}.json`;

  await fs.writeJson(
    file,
    data,
    { spaces: 2 }
  );
}

async function addMessage(
  chatId,
  role,
  content
) {

  const session =
    await loadSession(chatId);

  session.history.push({
    role,
    content,
    timestamp:
      new Date().toISOString()
  });

  if(session.history.length > 20) {

    session.history =
      session.history.slice(-20);
  }

  await saveSession(
    chatId,
    session
  );

  return session;
}

module.exports = {
  loadSession,
  saveSession,
  addMessage
};
