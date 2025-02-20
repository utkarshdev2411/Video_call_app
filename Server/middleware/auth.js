const jwt = require('jsonwebtoken');
const userController = require('../Controllers/user.controller');

const auth = (req, res, next) => {
    try {
        const token = req.header('Authorization').replace('Bearer ', '');
        if (userController.isTokenBlacklisted(token)) {
            return res.status(401).json({ msg: "Token is invalidated" });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        res.status(401).json({ msg: "Authentication failed" });
    }
};

module.exports = auth;