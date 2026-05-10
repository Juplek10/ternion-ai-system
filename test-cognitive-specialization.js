
const {

  selectReasoningMode

} = require(

  "./core/cognitive-router"
);

const {

  getSpecialist

} = require(

  "./core/cognitive-specialization-engine"
);

const tasks = [

  "Vendor proyek gudang",

  "Hitung RAB proyek",

  "Risk management",

  "Architecture optimization"
];

for(
  const task
  of tasks
) {

  const mode =

    selectReasoningMode(
      task
    );

  const specialist =

    getSpecialist(
      mode.mode
    );

  console.log(

    "\nTASK:",
    task

  );

  console.log(
    "MODE:",
    mode.mode
  );

  console.log(

    "SPECIALIST:",

    specialist
  );
}
