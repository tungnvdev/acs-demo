const express = require('express');
const cors = require('cors');
const { CommunicationIdentityClient } = require('@azure/communication-identity');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
const corsOptions = {
  origin: ['http://localhost:4200', 'http://127.0.0.1:4200'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  credentials: true
};
app.use(cors(corsOptions));
app.use(express.json());

// Initialize Azure Communication Service
const connectionString = process.env.AZURE_COMMUNICATION_CONNECTION_STRING;
if (!connectionString) {
  console.error('AZURE_COMMUNICATION_CONNECTION_STRING is not set');
  process.exit(1);
}

const identityClient = new CommunicationIdentityClient(connectionString);

// In-memory storage for demo purposes
const rooms = new Map();
const users = new Map();

// Routes

// Create a new room
app.post('/api/rooms', async (req, res) => {
  try {
    const { hostName } = req.body;
    const roomId = uuidv4();
    
    // Create identity for host
    const hostIdentity = await identityClient.createUser();
    const hostToken = await identityClient.getToken(hostIdentity, ["voip"]);
    
    const room = {
      id: roomId,
      hostId: hostIdentity.communicationUserId,
      hostName,
      participants: new Map(),
      waitingList: new Map(),
      isActive: true,
      createdAt: new Date()
    };
    
    // Add host to participants
    room.participants.set(hostIdentity.communicationUserId, {
      id: hostIdentity.communicationUserId,
      name: hostName,
      isHost: true,
      isMuted: false,
      isVideoOn: true
    });
    
    rooms.set(roomId, room);
    
    res.json({
      roomId,
      hostToken: hostToken.token,
      hostIdentity: hostIdentity.communicationUserId
    });
  } catch (error) {
    console.error('Error creating room:', error);
    res.status(500).json({ error: 'Failed to create room' });
  }
});

// Join room
app.post('/api/rooms/:roomId/join', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { userName, isHost } = req.body;
    
    const room = rooms.get(roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    
    if (!room.isActive) {
      return res.status(400).json({ error: 'Room is not active' });
    }
    
    // Create identity for user
    const userIdentity = await identityClient.createUser();
    const userToken = await identityClient.getToken(userIdentity, ["voip"]);
    
    const user = {
      id: userIdentity.communicationUserId,
      name: userName,
      isHost: false,
      isMuted: false,
      isVideoOn: true
    };
    
    if (isHost) {
      // Host joining - add directly to participants
      room.participants.set(userIdentity.communicationUserId, user);
    } else {
      // Regular user - add to waiting list
      room.waitingList.set(userIdentity.communicationUserId, user);
    }
    
    res.json({
      userToken: userToken.token,
      userIdentity: userIdentity.communicationUserId,
      isInWaitingRoom: !isHost
    });
  } catch (error) {
    console.error('Error joining room:', error);
    res.status(500).json({ error: 'Failed to join room' });
  }
});

// Get room info
app.get('/api/rooms/:roomId', (req, res) => {
  const { roomId } = req.params;
  const room = rooms.get(roomId);
  
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }
  
  res.json({
    id: room.id,
    hostName: room.hostName,
    participantCount: room.participants.size,
    waitingCount: room.waitingList.size,
    isActive: room.isActive
  });
});

// Approve user from waiting room
app.post('/api/rooms/:roomId/approve/:userId', (req, res) => {
  const { roomId, userId } = req.params;
  const room = rooms.get(roomId);
  
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }
  
  const user = room.waitingList.get(userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found in waiting room' });
  }
  
  // Move user from waiting list to participants
  room.waitingList.delete(userId);
  room.participants.set(userId, user);
  
  res.json({ success: true });
});

// Get waiting list
app.get('/api/rooms/:roomId/waiting', (req, res) => {
  const { roomId } = req.params;
  const room = rooms.get(roomId);
  
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }
  
  const waitingList = Array.from(room.waitingList.values());
  res.json(waitingList);
});

// End room
app.post('/api/rooms/:roomId/end', (req, res) => {
  const { roomId } = req.params;
  const room = rooms.get(roomId);
  
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }
  
  room.isActive = false;
  rooms.delete(roomId);
  
  res.json({ success: true });
});

// Leave room
app.post('/api/rooms/:roomId/leave/:userId', (req, res) => {
  const { roomId, userId } = req.params;
  const room = rooms.get(roomId);
  
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }
  
  // Remove from participants or waiting list
  room.participants.delete(userId);
  room.waitingList.delete(userId);
  
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
