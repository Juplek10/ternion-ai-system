const {

  getOrganizationMap,

  findDivision

} = require(

  "./core/digital-organization-engine"
);

console.log(

  "\nORGANIZATION MAP\n"
);

console.log(

  JSON.stringify(

    getOrganizationMap(),

    null,

    2
  )
);

console.log(

  "\nSEARCH DIVISION\n"
);

console.log(

  findDivision(
    "risk"
  )
);
