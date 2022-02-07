const jwt = require("jsonwebtoken");
// accessTokens
function generateAccessToken(user) {
    return jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {expiresIn: "30m"}) 
    }


module.exports = generateAccessToken
