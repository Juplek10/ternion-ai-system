const {

  performAutonomousAction

} = require(

  "./autonomous-action-engine"
);

function continuousEngineering(
  ecosystem
) {

  const engineeringActions = [];

  if(
    ecosystem
    .weakDebugging
  ) {

    engineeringActions.push(

      performAutonomousAction({

        type:
          "Create Debugging Module"
      })
    );
  }

  if(
    ecosystem
    .infrastructureAnalysisNeeded
  ) {

    engineeringActions.push(

      performAutonomousAction({

        type:
          "Run Infrastructure Scan"
      })
    );
  }

  if(
    engineeringActions.length === 0
  ) {

    engineeringActions.push({

      continuousEngineering:
        false,

      reason:
        "No engineering evolution required"
    });
  }

  return {

    continuousEngineering:
      true,

    engineeringActions
  };
}

module.exports = {
  continuousEngineering
};
