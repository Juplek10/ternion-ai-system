const {

  getOrganizations,

  findOrganizationByFocus

} = require(

  "./core/civilization-engine"
);

console.log(

  "\nORGANIZATIONS\n"
);

console.log(

  JSON.stringify(

    getOrganizations(),

    null,

    2
  )
);

console.log(

  "\nSEARCH FOCUS\n"
);

console.log(

  findOrganizationByFocus(
    "risk"
  )
);

