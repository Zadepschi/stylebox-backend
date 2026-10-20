
const { auth } = require("express-oauth2-jwt-bearer");

const checkJwt = auth({
  audience: "https://stylebox-api",
  issuerBaseURL: "https://dev-dnlqg6d4ea85rsco.us.auth0.com/",
  tokenSigningAlg: "RS256",
});

module.exports = checkJwt;
