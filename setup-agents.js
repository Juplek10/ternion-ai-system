const {
  registerAgent
} = require("./core/agents");

async function setup() {

  await registerAgent({
    name: "Estimator Agent",
    type: "estimation",
    skills: [
      "RAB",
      "BOQ",
      "quantity takeoff"
    ]
  });

  await registerAgent({
    name: "OCR Agent",
    type: "document",
    skills: [
      "OCR",
      "PDF analysis",
      "DED analysis"
    ]
  });

  await registerAgent({
    name: "Vendor Agent",
    type: "business",
    skills: [
      "vendor analysis",
      "supplier research"
    ]
  });

  console.log(
    "DEFAULT AGENTS CREATED"
  );
}

setup();
