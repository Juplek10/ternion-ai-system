const {
  approveAction
} = require(
  "./core/approval-engine"
);

const {
  processApprovals
} = require(
  "./core/approval-executor"
);

async function test() {

  await approveAction(
    1778325776478
  );

  await processApprovals();
}

test();
