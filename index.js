const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const path = require('path');

const app = express();
app.use(cors());

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // Allow all for MVP
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-room', (roomId) => {
    socket.join(roomId);
    console.log(`User ${socket.id} joined room: ${roomId}`);
  });

  socket.on('draw-event', (data) => {
    // Broadcast the drawing event to everyone else in the room
    socket.to(data.roomId).emit('draw-event', data);
  });

  socket.on('clear-canvas', (roomId) => {
    // Broadcast clear event to everyone else in the room
    socket.to(roomId).emit('clear-canvas');
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Sync server running on http://localhost:${PORT}`);
});
