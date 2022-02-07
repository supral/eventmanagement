const jwt = require("jsonwebtoken");

// refreshTokens
let refreshTokens = []
function generateRefreshToken(user) {
    const refreshToken = jwt.sign(user, process.env.REFRESH_TOKEN_SECRET, {expiresIn: "40m"})
    refreshTokens.push(refreshToken)
    return refreshToken
}

module.exports = generateRefreshToken