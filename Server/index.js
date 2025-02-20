require('dotenv').config();
require('./config/db.js'); 
const userRoutes = require('./Routes/user.routes'); // Import the user routes


const express = require('express');
const app = express();
const port = process.env.port || 3000;

const http = require('http');

const socketIo = require('socket.io');
const server=http.createServer(app);
const io =  socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});
io.on('connection', (socket) => {
    console.log('a user connected');
    socket.on('disconnect', () => {
        console.log('user disconnected');
    });
});


app.use(express.json()); // Middleware to parse JSON bodies

app.get('/', (req, res) => {
    res.status(200).json({ status: 'Welcome to App' });
});

app.use('/api/users', userRoutes); // Use the user routes

app.listen(port, () => {
    console.log(`Server started on port ${port}`);
});