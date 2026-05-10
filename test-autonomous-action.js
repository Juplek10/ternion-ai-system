const {

  performAutonomousAction

} = require(

  "./core/autonomous-action-engine"
);

const missions = [

  {
    type:
      "Create Debugging Module"
  },

  {
    type:
      "Run Infrastructure Scan"
  },

  {
    type:
      "Unknown Mission"
  }
];

for(
  const mission
  of missions
) {

  console.log(

    "\nMISSION:",

    mission.type
  );

  console.log(

    JSON.stringify(

      performAutonomousAction(
        mission
      ),

      null,

      2
    )
  );
}	
