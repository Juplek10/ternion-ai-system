const fs = require("fs-extra");

const APPROVAL_FILE =
  "/root/ai-system/approvals/pending.json";

async function loadApprovals() {

  try {

    return await fs.readJson(
      APPROVAL_FILE
    );

  } catch(err) {

    return [];
  }
}

async function saveApprovals(
  approvals
) {

  await fs.writeJson(
    APPROVAL_FILE,
    approvals,
    { spaces: 2 }
  );
}

async function createApproval(
  action
) {

  const approvals =
    await loadApprovals();

  const item = {

    id: Date.now(),

    createdAt:
      new Date().toISOString(),

    status:
      "pending",

    ...action
  };

  approvals.push(item);

  await saveApprovals(
    approvals
  );

  return item;
}

async function approveAction(
  id
) {

  const approvals =
    await loadApprovals();

  const item =
    approvals.find(
      a => a.id == id
    );

  if(!item) {

    return false;
  }

  item.status =
    "approved";

  await saveApprovals(
    approvals
  );

  return item;
}

module.exports = {
  createApproval,
  approveAction,
  loadApprovals
};
