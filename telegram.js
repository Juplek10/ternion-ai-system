require("dotenv").config();

const { Telegraf } =
  require("telegraf");

const axios =
  require("axios");

const fs =
  require("fs");

const path =
  require("path");
const fsExtra =
  require("fs");

const {

  addFileMemory,
  getLastFile,
  removeFileMemory

} = require(
  "./core/file-memory"
);
const {

  addTask

} = require(
  "./core/queue"
);

const routeTask = require(
  "./core/router/router"
);

const {

  loadSession,
  addMessage

} = require(
  "./core/session"
);

const {

  runAutonomousLoop

} = require(
  "./core/autonomous-runtime-loop"
);

const {

  governCivilization

} = require(
  "./core/civilization-governor-engine"
);

const {

  superviseEcosystem

} = require(
  "./core/ecosystem-supervisor"
);

const {

  performAutonomousAction

} = require(
  "./core/autonomous-action-engine"
);

const TELEGRAM_TOKEN =
  "8615852356:AAGzjiONLbkuSKBvXePPwhuKACkCZMC0QaY";

const AUTHORIZED_USERS = [

  6935073123
];

const bot =
  new Telegraf(
    TELEGRAM_TOKEN
  );

function isAuthorized(
  chatId
) {

  return AUTHORIZED_USERS
    .includes(chatId);
}

/*
===================================
START COMMAND
===================================
*/

bot.start(async (ctx) => {

  const chatId =
    ctx.chat.id;

  if(
    !isAuthorized(chatId)
  ) {

    return ctx.reply(
      "Unauthorized access."
    );
  }

  await ctx.reply(

    "Civilization Runtime Online.\n\n" +

    "Commands:\n" +

    "- status ecosystem\n" +
    "- govern civilization\n" +
    "- supervise ecosystem\n" +
    "- create debugging module\n" +
    "- runtime engineering\n"
  );
});

/*
===================================
DOCUMENT PIPELINE
===================================
*/

bot.on(
  "document",

  async (ctx) => {

    const chatId =
      ctx.chat.id;

    if(
      !isAuthorized(chatId)
    ) {

      return ctx.reply(
        "Unauthorized access."
      );
    }

    try {

      const document =

        ctx.message.document;

      const fileId =
        document.file_id;

      const fileName =
        document.file_name;

      const file =

        await ctx.telegram
        .getFile(fileId);

      const fileUrl =

        `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${file.file_path}`;

      const uploadDir =

        path.join(
          __dirname,
          "workspace",
          "uploads"
        );

      if(
        !fs.existsSync(
          uploadDir
        )
      ) {

        fs.mkdirSync(
          uploadDir,
          {
            recursive: true
          }
        );
      }

      const uploadPath =

        path.join(
          uploadDir,
          fileName
        );

      const response =

        await axios({

          url: fileUrl,

          method: "GET",

          responseType:
            "stream"
        });

      const writer =

        fs.createWriteStream(
          uploadPath
        );

      response.data.pipe(
        writer
      );

      writer.on(
        "finish",

        async () => {

          console.log(
            "FILE SAVED:",
            uploadPath
          );
		addFileMemory({

 	 fileName:
 	   fileName,

	  path:
 	   uploadPath,

	  uploadedBy:
 	   chatId,

	  status:
	    "uploaded"
		});

          await ctx.reply(

            `File received:\n${fileName}\n\nSaved to:\n${uploadPath}`
          );
        }
      );

      writer.on(
        "error",

        async () => {

          await ctx.reply(
            "File save failed."
          );
        }
      );

    } catch(error) {

      console.log(error);

      await ctx.reply(
        "Document pipeline error."
      );
    }
  }
);

/*
===================================
TEXT COMMANDS
===================================
*/

bot.on(
  "text",

  async (ctx) => {

    const originalText =
      ctx.message.text.trim();

    const text =
      originalText.toLowerCase();

    const chatId =
      ctx.chat.id;

    if(
      !isAuthorized(chatId)
    ) {

      return ctx.reply(
        "Unauthorized access."
      );
    }

    console.log(
      "COMMAND:",
      text
    );

    try {

      /*
      STATUS ECOSYSTEM
      */

      if(
        text ===
        "status ecosystem"
      ) {

        const ecosystem = {

          runtimeOverload: false,

          debuggingFailures: false,

          researchStagnation: false,

          federationInstability: false,

          infrastructureOverload: false,

          evolutionNeeded: true,

          experimentationNeeded: true,

          weakDebugging: false,

          infrastructureAnalysisNeeded: true,

          highDebuggingSuccess: true
        };

        const runtime =

          runAutonomousLoop(
            ecosystem
          );

        return ctx.reply(

          JSON.stringify(
            runtime,
            null,
            2
          )
        );
      }

      /*
      GOVERNANCE
      */

      if(
        text ===
        "govern civilization"
      ) {

        const governance =

          governCivilization({

            infrastructureOverload:
              true,

            highDebuggingSuccess:
              true,

            researchStagnation:
              false,

            federationInstability:
              false
          });

        return ctx.reply(

          JSON.stringify(
            governance,
            null,
            2
          )
        );
      }

      /*
      SUPERVISION
      */

      if(
        text ===
        "supervise ecosystem"
      ) {

        const supervision =

          superviseEcosystem({

            runtimeOverload:
              true,

            debuggingFailures:
              true,

            researchStagnation:
              false,

            federationInstability:
              false
          });

        return ctx.reply(

          JSON.stringify(
            supervision,
            null,
            2
          )
        );
      }

      /*
      DEBUGGING MODULE
      */

      if(
        text ===
        "create debugging module"
      ) {

        const result =

          performAutonomousAction({

            type:
              "Create Debugging Module"
          });

        return ctx.reply(

          JSON.stringify(
            result,
            null,
            2
          )
        );
      }

      /*
      INFRASTRUCTURE
      */

      if(text === "runtime engineering") {

        const result = performAutonomousAction({
          type: "Run Infrastructure Scan"
        });

        return ctx.reply(
          JSON.stringify(result, null, 2).substring(0, 4096)
        );
      }

      /*
      DELETE LAST FILE
      */

      if(text.includes("hapus file")) {

        const lastFile = getLastFile();

        if(!lastFile) {
          return ctx.reply("No file memory found.");
        }

        return ctx.reply(
          `Approval required.\n\nDelete:\n${lastFile.fileName}\n\nReply:\nAPPROVE DELETE`
        );
      }

      /*
      APPROVE DELETE
      */

      if(text === "approve delete") {

        const lastFile = getLastFile();

        if(!lastFile) {
          return ctx.reply("No file memory found.");
        }

        try {

          fsExtra.unlinkSync(lastFile.path);
          removeFileMemory(lastFile.path);
          return ctx.reply(`Deleted:\n${lastFile.fileName}`);

        } catch(error) {

          console.log(error);
          return ctx.reply("Delete failed.");
        }
      }

      /*
      FALLBACK QUEUE
      */

      // Kirim "sedang mengetik..." saat AI memproses
      await ctx.sendChatAction("typing");

      // Bangun prompt dengan history percakapan
      const session = await loadSession(chatId);
      const history = session.history
        .slice(-10)
        .map(m => `${m.role === "assistant" ? "ASSISTANT" : "USER"}: ${m.content}`)
        .join("\n");

      const fullPrompt = history
        ? `${history}\nUSER: ${originalText}`
        : originalText;

      // Panggil Ollama langsung — tidak melalui queue
      const aiReply = await routeTask("light", fullPrompt);

      // Simpan ke session history
      await addMessage(chatId, "user",      originalText);
      await addMessage(chatId, "assistant", aiReply);

      return ctx.reply(aiReply.substring(0, 4096));

    } catch(error) {

      console.log(
        "TELEGRAM ERROR:",
        error
      );

      return ctx.reply(
        "Civilization runtime error."
      );
    }
  }
);

bot.launch({ dropPendingUpdates: true });

console.log(
  "TELEGRAM CIVILIZATION ONLINE"
);

/*
===================================
GRACEFUL SHUTDOWN
===================================
*/

process.once(
  "SIGINT",

  () => bot.stop(
    "SIGINT"
  )
);

process.once(
  "SIGTERM",

  () => bot.stop(
    "SIGTERM"
  )
);
