require('dotenv').config();
require('./config/db.js'); 
const userRoutes = require('./Routes/user.routes');

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;

// Read your SSL certificate and key. Replace with your actual file paths.
const options = {
  key: fs.readFileSync('key.pem'),
  cert: fs.readFileSync('cert.pem')
};

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.status(200).json({ status: 'Welcome to App' });
});

app.use('/api/users', userRoutes);

// Create an HTTPS server using the certificate options.
const server = https.createServer(options, app);

// Initialize Socket.io on the HTTPS server.
const socketIo = require('socket.io');
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Track active rooms and their participants.
const rooms = {};

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  // Join room event: a client must send a roomId and (optionally) a userId.
  socket.on('join-room', (roomId, userId) => {
    // Use socket.id if userId is not provided.
    userId = userId || socket.id;
    console.log(`User ${userId} joining room ${roomId}`);
    
    // Remove from any previous rooms.
    Object.keys(rooms).forEach(room => {
      if (rooms[room].includes(socket.id)) {
        rooms[room] = rooms[room].filter(id => id !== socket.id);
        if (rooms[room].length === 0) {
          delete rooms[room];
        }
      }
    });
    
    // Join the new room.
    socket.join(roomId);
    if (!rooms[roomId]) {
      rooms[roomId] = [];
    }
    rooms[roomId].push(socket.id);
    
    // Send the list of other users in the room back to the joining client.
    const otherUsers = rooms[roomId].filter(id => id !== socket.id);
    socket.emit('room-users', otherUsers);
    
    // Notify others in the room about the new connection.
    socket.to(roomId).emit('user-connected', socket.id);
    console.log(`Current users in room ${roomId}:`, rooms[roomId]);
  });

  // Allow clients to get the list of users in a room.
  socket.on('get-users', (roomId, callback) => {
    const users = rooms[roomId] || [];
    callback(users);
  });

  // Forward the offer to the intended target user.
  socket.on('offer', ({ offer, roomId, targetUserId }) => {
    if (rooms[roomId] && rooms[roomId].includes(targetUserId)) {
      io.to(targetUserId).emit('offer', { offer, senderId: socket.id });
      console.log(`Offer sent to ${targetUserId} in room ${roomId}`);
    } else {
      console.error(`Offer failed: Target user ${targetUserId} is not in room ${roomId}`);
    }
  });

  // Forward the answer similarly.
  socket.on('answer', ({ answer, roomId, targetUserId }) => {
    if (rooms[roomId] && rooms[roomId].includes(targetUserId)) {
      io.to(targetUserId).emit('answer', { answer, senderId: socket.id });
      console.log(`Answer sent to ${targetUserId} in room ${roomId}`);
    } else {
      console.error(`Answer failed: Target user ${targetUserId} is not in room ${roomId}`);
    }
  });

  // Forward ICE candidates to the target user.
  socket.on('ice-candidate', ({ candidate, roomId, targetUserId }) => {
    if (targetUserId && rooms[roomId] && rooms[roomId].includes(targetUserId)) {
      io.to(targetUserId).emit('ice-candidate', { candidate, senderId: socket.id });
      console.log(`ICE candidate sent to ${targetUserId} in room ${roomId}`);
    } else {
      console.error(`ICE candidate failed: Target user ${targetUserId} is not in room ${roomId}`);
    }
  });

  // Clean up when a user disconnects.
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    Object.keys(rooms).forEach(room => {
      if (rooms[room].includes(socket.id)) {
        rooms[room] = rooms[room].filter(id => id !== socket.id);
        io.to(room).emit('user-disconnected', socket.id);
        if (rooms[room].length === 0) {
          delete rooms[room];
        } else {
          io.to(room).emit('room-users', rooms[room]);
        }
      }
    });
  });
});

server.listen(PORT, () => {
  console.log(`HTTPS Server started on port ${PORT}`);
});
