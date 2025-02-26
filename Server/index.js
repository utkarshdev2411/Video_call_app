require('dotenv').config(); // Load environment variables from .env file.
require('./config/db.js'); // Establish database connection.
const userRoutes = require('./Routes/user.routes'); // Import user-related routes.

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000; // Define the port for the server to listen on.

// Read SSL certificate and key for HTTPS.
const options = {
  key: fs.readFileSync('key.pem'), // Path to the SSL key file.
  cert: fs.readFileSync('cert.pem') // Path to the SSL certificate file.
};

app.use(cors()); // Enable Cross-Origin Resource Sharing for all routes.
app.use(express.json()); // Parse incoming JSON requests.

// Define a simple route for the root endpoint.
app.get('/', (req, res) => {
  res.status(200).json({ status: 'Welcome to App' });
});

app.use('/api/users', userRoutes); // Mount user routes under the '/api/users' path.

// Create an HTTPS server with the provided SSL options and Express app.
const server = https.createServer(options, app);

// Initialize Socket.io on the HTTPS server to handle real-time communication.
const socketIo = require('socket.io');
const io = socketIo(server, {
  cors: {
    origin: '*', // Allow connections from any origin.  Consider restricting this in production.
    methods: ['GET', 'POST'] // Allow only GET and POST methods.
  }
});

// rooms: An object to track active rooms and the socket IDs of users within each room.
const rooms = {};

// Socket.io event handling.
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  // 'join-room' event: Allows a user to join a specific room.
  socket.on('join-room', (roomId, userId) => {
    // If userId is not provided, use the socket ID as the user identifier.
    userId = userId || socket.id;
    console.log(`User ${userId} joining room ${roomId}`);
    
    // Ensure the user leaves any previously joined rooms.
    Object.keys(rooms).forEach(room => {
      if (rooms[room] && rooms[room].includes(socket.id)) {
        rooms[room] = rooms[room].filter(id => id !== socket.id);
        if (rooms[room].length === 0) {
          delete rooms[room]; // Remove the room if it's empty.
        }
      }
    });
    
    // Join the specified room.
    socket.join(roomId);
    if (!rooms[roomId]) {
      rooms[roomId] = []; // Initialize the room if it doesn't exist.
    }
    rooms[roomId].push(socket.id); // Add the user's socket ID to the room.
    
    // Emit 'room-users' event to the joining user with a list of other users in the room.
    const otherUsers = rooms[roomId].filter(id => id !== socket.id);
    socket.emit('room-users', otherUsers);
    
    // Notify other users in the room that a new user has connected.
    socket.to(roomId).emit('user-connected', socket.id);
    console.log(`Current users in room ${roomId}:`, rooms[roomId]);
  });

  // 'get-users' event: Allows a client to retrieve a list of users in a room.
  socket.on('get-users', (roomId, callback) => {
    const users = rooms[roomId] || [];
    callback(users); // Execute the callback with the list of users.
  });

  // 'offer' event: Forwards an SDP offer to a specific user in a room.
  socket.on('offer', ({ offer, roomId, targetUserId }) => {
    if (rooms[roomId] && rooms[roomId].includes(targetUserId)) {
      io.to(targetUserId).emit('offer', { offer, senderId: socket.id });
      console.log(`Offer sent to ${targetUserId} in room ${roomId}`);
    } else {
      console.error(`Offer failed: Target user ${targetUserId} is not in room ${roomId}`);
    }
  });

  // 'answer' event: Forwards an SDP answer to a specific user in a room.
  socket.on('answer', ({ answer, roomId, targetUserId }) => {
    if (rooms[roomId] && rooms[roomId].includes(targetUserId)) {
      io.to(targetUserId).emit('answer', { answer, senderId: socket.id });
      console.log(`Answer sent to ${targetUserId} in room ${roomId}`);
    } else {
      console.error(`Answer failed: Target user ${targetUserId} is not in room ${roomId}`);
    }
  });

  // 'ice-candidate' event: Forwards ICE candidates to a specific user in a room.
  socket.on('ice-candidate', ({ candidate, roomId, targetUserId }) => {
    if (targetUserId && rooms[roomId] && rooms[roomId].includes(targetUserId)) {
      io.to(targetUserId).emit('ice-candidate', { candidate, senderId: socket.id });
      console.log(`ICE candidate sent to ${targetUserId} in room ${roomId}`);
    } else {
      console.error(`ICE candidate failed: Target user ${targetUserId} is not in room ${roomId}`);
    }
  });

  // 'disconnect' event: Handles user disconnection.
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    Object.keys(rooms).forEach(room => {
      if (rooms[room] && rooms[room].includes(socket.id)) {
        rooms[room] = rooms[room].filter(id => id !== socket.id);
        io.to(room).emit('user-disconnected', socket.id); // Notify users in the room.
        if (rooms[room].length === 0) {
          delete rooms[room]; // Remove the room if it's empty.
        } else {
          io.to(room).emit('room-users', rooms[room]); // Update the list of users in the room.
        }
      }
    });
  });
});

// Start the HTTPS server and listen for incoming connections.
server.listen(PORT, () => {
  console.log(`HTTPS Server started on port ${PORT}`);
});