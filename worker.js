require("dotenv").config();

const axios = require("axios");

const {
  loadSession,
  addMessage
} = require("./core/session");

const {
  getTasks,
  updateTask
} = require("./core/queue");

const routeTask =
  require("./core/router/router");

const {
  saveMemory
} = require("./core/memory/memory");

async function processTasks() {

  const tasks =
    await getTasks();

  const pending =
    tasks.filter(
      t => t.status === "pending"
    );

  for(const task of pending) {

    console.log(
      "\n===================="
    );

    console.log(
      "PROCESSING TASK"
    );

    console.log(task.id);

    console.log(
      "===================="
    );

    try {

      await updateTask(
        task.id,
        {
          status: "processing"
        }
      );

      let finalPrompt =
        task.prompt;

      if(task.telegramChatId) {

        const session =
          await loadSession(
            task.telegramChatId
          );

        const history =
          session.history
            .map(
              msg =>
                `${msg.role}: ${msg.content}`
            )
            .join("\n");

        finalPrompt = `
Conversation History:

${history}

Current User Message:
${task.prompt}
`;
      }

      const result =
        await routeTask(
          task.type,
          finalPrompt
        );

      console.log(result);

      if(task.telegramChatId) {

        await addMessage(
          task.telegramChatId,
          "assistant",
          result
        );

        console.log(
          "SENDING TELEGRAM RESPONSE"
        );

        try {

          await axios.post(
            `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
            {
              chat_id:
                task.telegramChatId,

              text:
                result.substring(0,3000)
            }
          );

          console.log(
            "TELEGRAM RESPONSE SENT"
          );

        } catch(err) {

          console.log(
            "TELEGRAM ERROR"
          );

          console.log(
            err.message
          );
        }
      }

      await saveMemory({
        type: "task_result",
        taskId: task.id,
        result
      });

      await updateTask(
        task.id,
        {
          status: "completed",
          result
        }
      );

    } catch(err) {

      console.error(
        err.message
      );

      await updateTask(
        task.id,
        {
          status: "failed",
          error: err.message
        }
      );
    }
  }
}

processTasks();

setInterval(
  processTasks,
  30000
);
