const {

  safeExecuteCommand,

  safeWriteFile

} = require(

  "./core/safe-action-engine"
);

console.log(

  "\nSAFE COMMAND TEST\n"
);

console.log(

  JSON.stringify(

    safeExecuteCommand(
      "ls"
    ),

    null,

    2
  )
);

console.log(

  "\nBLOCKED COMMAND TEST\n"
);

console.log(

  JSON.stringify(

    safeExecuteCommand(
      "rm -rf /"
    ),

    null,

    2
  )
);

console.log(

  "\nSAFE FILE WRITE\n"
);

console.log(

  JSON.stringify(

    safeWriteFile(

      "/root/ai-system/sandbox/test.txt",

      "autonomous civilization"
    ),

    null,

    2
  )
);

console.log(

  "\nBLOCKED FILE WRITE\n"
);

console.log(

  JSON.stringify(

    safeWriteFile(

      "/etc/passwd",

      "hack"
    ),

    null,

    2
  )
);
