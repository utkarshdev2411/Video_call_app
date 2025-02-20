const bcrypt = require('bcrypt'); // Library for hashing passwords
const jwt = require('jsonwebtoken'); // Library for generating and verifying JWT tokens
const User = require("../Modals/user.modal"); // User model

// In-memory token blacklist to store invalidated tokens
const tokenBlacklist = new Set();

const userController = {
    // Register a new user
    register: async (req, res) => {
        try {
            const { name, email, password } = req.body;

            // Check if all fields are provided
            if (!name || !email || !password) {
                return res.status(400).json({ msg: "Please fill all fields" });
            }

            // Check if password length is at least 6 characters
            if (password.length < 6) {
                return res.status(400).json({ msg: "Password should be at least 6 characters" });
            }

            // Check if user already exists
            const user = await User.findOne({ email });
            if (user) {
                return res.status(400).json({ msg: "User already exists" });
            }

            // Hash the password
            const hashedPassword = await bcrypt.hash(password, 10);
            const newUser = new User({ name, email, password: hashedPassword });

            // Save the new user to the database
            await newUser.save();
            res.status(201).json({ msg: "User registered successfully" });
        } catch (err) {
            console.log(err);
            res.status(500).json({ msg: "Server error" });
        }
    },
    // Login a user
    login: async (req, res) => {
        try {
            const { email, password } = req.body;

            // Check if all fields are provided
            if (!email || !password) {
                return res.status(400).json({ msg: "Please fill all fields" });
            }

            // Check if user exists
            const user = await User.findOne({ email });
            if (!user) {
                return res.status(400).json({ msg: "User does not exist" });
            }

            // Compare provided password with the hashed password in the database
            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) {
                return res.status(400).json({ msg: "Invalid credentials" });
            }

            // Generate JWT token
            const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

            res.status(200).json({ msg: "User logged in successfully", token });
        } catch (err) {
            console.log(err);
            res.status(500).json({ msg: "Server error" });
        }
    },
    // Logout a user
    logout: async (req, res) => {
        try {
            // Get the token from the Authorization header
            const token = req.header('Authorization').replace('Bearer ', '');
            // Add the token to the blacklist
            tokenBlacklist.add(token);

            res.status(200).json({ msg: "User logged out successfully" });
        } catch (err) {
            console.log(err);
            res.status(500).json({ msg: "Server error" });
        }
    },
    // Check if a token is blacklisted
    isTokenBlacklisted: (token) => {
        return tokenBlacklist.has(token);
    }
};

module.exports = userController;