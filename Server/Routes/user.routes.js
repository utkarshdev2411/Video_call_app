const express = require('express');
const router = express.Router();
const userController = require('../Controllers/user.controller');
const auth = require('../middleware/auth');

router.post('/register', userController.register);
router.post('/login', userController.login);
router.post('/logout', auth, userController.logout);

module.exports = router;