const {
  loadApprovals
} = require(
  "./approval-engine"
);
const {
  handleAction
} = require(
  "./action-handler"
);


async function processApprovals() {

  const approvals =
    await loadApprovals();

  const approved =
    approvals.filter(
      a =>
        a.status ===
        "approved"
    );

  for(const item of approved) {

    console.log(
      "\n===================="
    );

    console.log(
      "EXECUTING APPROVED ACTION"
    );

    console.log(item);
	const result =
  await handleAction(
    item
  );

console.log(result);
    console.log(
      "===================="
    );
  }
}

module.exports = {
  processApprovals
};
