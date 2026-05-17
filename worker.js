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


        const session =
          await loadSession(
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


        await addMessage(
          "assistant",
          result
        );

        console.log(
        );

        try {

          console.log('[NOTIFY]', message)
            }
          );

          console.log(
          );

        } catch(err) {

          console.log(
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
