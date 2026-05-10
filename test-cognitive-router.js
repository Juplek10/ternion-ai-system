const {

  selectReasoningMode

} = require(

  "./core/cognitive-router"
);

const tests = [

  "Vendor analysis proyek",

  "Hitung RAB gudang",

  "Timeline proyek jalan",

  "Risk management vendor",

  "Architecture optimization"
];

for(
  const test
  of tests
) {

  console.log(

    test,

    "=>",

    selectReasoningMode(
      test
    )
  );
}
