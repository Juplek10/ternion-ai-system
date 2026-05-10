const fs =
  require("fs");

const {

  applyPatch,

  rollback

} = require(
  "./core/safe-patch-loop"
);

const file =
  "/root/ai-system/sandbox/test.md";

const original =
  fs.readFileSync(
    file,
    "utf8"
  );

const backup =
  applyPatch(

    file,

    "PATCHED CONTENT"
  );

console.log(
  "\nPATCH APPLIED\n"
);

console.log(
  fs.readFileSync(
    file,
    "utf8"
  )
);

rollback(
  file,
  backup
);

console.log(
  "\nROLLBACK COMPLETE\n"
);

console.log(
  fs.readFileSync(
    file,
    "utf8"
  )
);
