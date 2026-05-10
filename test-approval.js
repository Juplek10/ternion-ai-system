const {
  createApproval,
  loadApprovals
} = require(
  "./core/approval-engine"
);

async function test() {

  await createApproval({

    type:
      "system-edit",

    description:
      "Restart worker service"
  });

  const approvals =
    await loadApprovals();

  console.log(approvals);
}

test();
