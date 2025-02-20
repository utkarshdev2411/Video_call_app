const jwt = require('jsonwebtoken'); // Library for generating and verifying JWT tokens
const userController = require('../Controllers/user.controller'); // Import the user controller to access token blacklist

// Middleware function to authenticate requests
const auth = (req, res, next) => {
    try {
        // Get the token from the Authorization header and remove the 'Bearer ' prefix
        const token = req.header('Authorization').replace('Bearer ', '');

        // Check if the token is blacklisted
        if (userController.isTokenBlacklisted(token)) {
            return res.status(401).json({ msg: "Token is invalidated" });
        }

        // Verify the token using the secret key
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Attach the decoded user information to the request object
        req.user = decoded;

        // Call the next middleware or route handler
        next();
    } catch (err) {
        // If token verification fails, respond with an authentication error
        res.status(401).json({ msg: "Authentication failed" });
    }
};

module.exports = auth; // Export the middleware function