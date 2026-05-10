const {
  getCapabilities
} = require(
  "./capability-engine"
);

async function detectGap(
  prompt
) {

  const capabilities =
    await getCapabilities();

  const lower =
    prompt.toLowerCase();

  const result = {
    hasCapability: true,
    missing: []
  };

  if(
    lower.includes("pdf")
  ) {

    const hasPdfAgent =
      capabilities.agents.some(
        a =>
          a.name.includes("pdf") ||
          a.name.includes("ocr")
      );

    if(!hasPdfAgent) {

      result.hasCapability =
        false;

      result.missing.push(
        "pdf-agent"
      );
    }
  }

  if(
    lower.includes("vendor")
  ) {

    const hasVendorAgent =
      capabilities.agents.some(
        a =>
          a.name.includes("vendor")
      );

    if(!hasVendorAgent) {

      result.hasCapability =
        false;

      result.missing.push(
        "vendor-agent"
      );
    }
  }

  return result;
}

module.exports =
  detectGap;
