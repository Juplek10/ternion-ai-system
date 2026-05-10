const {

  getAlliances,

  findAlliance

} = require(

  "./core/civilization-strategy-engine"
);

console.log(

  "\nALLIANCES\n"
);

console.log(

  JSON.stringify(

    getAlliances(),

    null,

    2
  )
);

console.log(

  "\nSEARCH ORGANIZATION\n"
);

console.log(

  JSON.stringify(

    findAlliance(
      "Engineering Organization"
    ),

    null,

    2
  )
);
