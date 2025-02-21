require('dotenv').config();
require('./config/db.js'); 
const userRoutes = require('./Routes/user.routes'); // Import the user routes

const express = require('express');
const cors = require('cors'); // Import the cors package
const app = express();
const port = process.env.port || 3000;

const http = require('http');

const socketIo = require('socket.io');
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});
io.on('connection', (socket) => {
    console.log('a user connected');
    socket.on('offer', (offer) => {
        socket.broadcast.emit('offer', offer);
    });

    socket.on('answer', (answer) => {
        socket.broadcast.emit('answer', answer);
    });

    socket.on('ice-candidate', (candidate) => {
        socket.broadcast.emit('ice-candidate', candidate);
    });
    socket.on('disconnect', () => {
        console.log('user disconnected');
    });
});

app.use(cors()); // Enable CORS for all routes
app.use(express.json()); // Middleware to parse JSON bodies

app.get('/', (req, res) => {
    res.status(200).json({ status: 'Welcome to App' });
});

app.use('/api/users', userRoutes); // Use the user routes

server.listen(port, () => {
    console.log(`Server started on port ${port}`);
});