const express = require('express');
const cors = require('cors');
const { CommunicationIdentityClient } = require('@azure/communication-identity');
const { RoomsClient } = require('@azure/communication-rooms');
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

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  const method = req.method;
  const url = req.url;
  const ip = req.ip || req.connection.remoteAddress;
  
  console.log(`[${timestamp}] ${method} ${url} - IP: ${ip}`);
  
  // Log request body for POST/PUT requests
  if (req.method === 'POST' || req.method === 'PUT') {
    console.log(`[${timestamp}] Request Body:`, JSON.stringify(req.body, null, 2));
  }
  
  // Log response when it's sent
  const originalSend = res.send;
  res.send = function(data) {
    console.log(`[${timestamp}] Response Status: ${res.statusCode}`);
    if (data) {
      try {
        const responseData = JSON.parse(data);
        console.log(`[${timestamp}] Response Body:`, JSON.stringify(responseData, null, 2));
      } catch (e) {
        console.log(`[${timestamp}] Response Body:`, data);
      }
    }
    originalSend.call(this, data);
  };
  
  next();
});

// Initialize Azure Communication Service
const connectionString = process.env.AZURE_COMMUNICATION_CONNECTION_STRING;
if (!connectionString) {
  console.error('AZURE_COMMUNICATION_CONNECTION_STRING is not set');
  process.exit(1);
}

const identityClient = new CommunicationIdentityClient(connectionString);
const roomsClient = new RoomsClient(connectionString);

// In-memory storage for demo purposes (for additional metadata)
const roomMetadata = new Map();
const users = new Map();

// Routes

// Get all rooms
app.get('/api/rooms', async (req, res) => {
  try {
    const rooms = [];
    for await (const room of roomsClient.listRooms()) {
      const roomData = roomMetadata.get(room.id);
      rooms.push({
        id: room.id,
        validFrom: room.validFrom,
        validUntil: room.validUntil,
        hostName: roomData?.hostName || 'Unknown',
        participantCount: roomData?.participants.size || 0,
        waitingCount: roomData?.waitingList.size || 0,
        isActive: roomData?.isActive || false
      });
    }
    res.json(rooms);
  } catch (error) {
    console.error('Error listing rooms:', error);
    res.status(500).json({ error: 'Failed to list rooms' });
  }
});

// Create a new room
app.post('/api/rooms', async (req, res) => {
  try {
    const { hostName } = req.body;
    
    // Create identity for host
    const hostIdentity = await identityClient.createUser();
    const hostToken = await identityClient.getToken(hostIdentity, ["voip"]);
    
    // Create room using Azure Rooms service
    const createRoomOptions = {
      validFrom: new Date(),
      validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
      participants: [
        {
          id: { 
            communicationUserId: hostIdentity.communicationUserId 
          },
          role: 'Presenter' // Host role
        }
      ]
    };
    
    const azureRoom = await roomsClient.createRoom(createRoomOptions);
    
    // Store additional metadata for our demo
    const roomData = {
      id: azureRoom.id,
      hostId: hostIdentity.communicationUserId,
      hostName,
      participants: new Map(),
      waitingList: new Map(),
      isActive: true,
      createdAt: new Date()
    };
    
    // Add host to participants
    roomData.participants.set(hostIdentity.communicationUserId, {
      id: hostIdentity.communicationUserId,
      name: hostName,
      isHost: true,
      isMuted: false,
      isVideoOn: true
    });
    
    roomMetadata.set(azureRoom.id, roomData);
    
    res.json({
      roomId: azureRoom.id,
      hostToken: hostToken.token,
      hostIdentity: hostIdentity.communicationUserId,
      validFrom: azureRoom.validFrom,
      validUntil: azureRoom.validUntil
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
    
    // Check if room exists in Azure
    let azureRoom;
    try {
      azureRoom = await roomsClient.getRoom(roomId);
    } catch (error) {
      return res.status(404).json({ error: 'Room not found' });
    }
    
    // Check if room is still valid
    const now = new Date();
    if (now < azureRoom.validFrom || now > azureRoom.validUntil) {
      return res.status(400).json({ error: 'Room is not active or has expired' });
    }
    
    // Get our metadata
    const roomData = roomMetadata.get(roomId);
    if (!roomData || !roomData.isActive) {
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
      // Host joining - add directly to participants and Azure room
      roomData.participants.set(userIdentity.communicationUserId, user);
      
      // Add to Azure room as Presenter
      await roomsClient.addOrUpdateParticipants(roomId, [
        {
          id: { 
            communicationUserId: userIdentity.communicationUserId 
          },
          role: 'Presenter'
        }
      ]);
    } else {
      // Regular user - add to waiting list (not added to Azure room yet)
      roomData.waitingList.set(userIdentity.communicationUserId, user);
    }
    
    res.json({
      userToken: userToken.token,
      userIdentity: userIdentity.communicationUserId,
      isInWaitingRoom: !isHost,
      roomValidUntil: azureRoom.validUntil
    });
  } catch (error) {
    console.error('Error joining room:', error);
    res.status(500).json({ error: 'Failed to join room' });
  }
});

// Get room info
app.get('/api/rooms/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;
    
    // Get Azure room info
    let azureRoom;
    try {
      azureRoom = await roomsClient.getRoom(roomId);
    } catch (error) {
      return res.status(404).json({ error: 'Room not found' });
    }
    
    // Get our metadata
    const roomData = roomMetadata.get(roomId);
    if (!roomData) {
      return res.status(404).json({ error: 'Room metadata not found' });
    }
    
    res.json({
      id: roomData.id,
      hostName: roomData.hostName,
      participantCount: roomData.participants.size,
      waitingCount: roomData.waitingList.size,
      isActive: roomData.isActive,
      validFrom: azureRoom.validFrom,
      validUntil: azureRoom.validUntil
    });
  } catch (error) {
    console.error('Error getting room info:', error);
    res.status(500).json({ error: 'Failed to get room info' });
  }
});

// Approve user from waiting room
app.post('/api/rooms/:roomId/approve/:userId', async (req, res) => {
  try {
    const { roomId, userId } = req.params;
    const roomData = roomMetadata.get(roomId);
    
    if (!roomData) {
      return res.status(404).json({ error: 'Room not found' });
    }
    
    const user = roomData.waitingList.get(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found in waiting room' });
    }
    
    // Move user from waiting list to participants
    roomData.waitingList.delete(userId);
    roomData.participants.set(userId, user);
    
    // Add user to Azure room as Attendee
    await roomsClient.addOrUpdateParticipants(roomId, [
      {
        id: { 
          communicationUserId: userId 
        },
        role: 'Attendee'
      }
    ]);
    
    // Mark user as approved
    user.isApproved = true;
    user.approvedAt = new Date();
    
    res.json({ 
      success: true, 
      message: 'User approved successfully',
      user: {
        id: user.id,
        name: user.name,
        isApproved: true,
        approvedAt: user.approvedAt
      }
    });
  } catch (error) {
    console.error('Error approving user:', error);
    res.status(500).json({ error: 'Failed to approve user' });
  }
});

// Check user approval status
app.get('/api/rooms/:roomId/user/:userId/status', (req, res) => {
  const { roomId, userId } = req.params;
  const roomData = roomMetadata.get(roomId);
  
  if (!roomData) {
    return res.status(404).json({ error: 'Room not found' });
  }
  
  // Check if user is in participants (approved)
  const participant = roomData.participants.get(userId);
  if (participant) {
    return res.json({
      isApproved: true,
      isInRoom: true,
      user: participant
    });
  }
  
  // Check if user is still in waiting list
  const waitingUser = roomData.waitingList.get(userId);
  if (waitingUser) {
    return res.json({
      isApproved: false,
      isInRoom: false,
      isWaiting: true,
      user: waitingUser
    });
  }
  
  // User not found
  return res.status(404).json({ error: 'User not found' });
});

// Get waiting list
app.get('/api/rooms/:roomId/waiting', (req, res) => {
  const { roomId } = req.params;
  const roomData = roomMetadata.get(roomId);
  
  if (!roomData) {
    return res.status(404).json({ error: 'Room not found' });
  }
  
  const waitingList = Array.from(roomData.waitingList.values());
  res.json(waitingList);
});

// Get participant information by communicationUserId
app.get('/api/rooms/:roomId/participant/:userId', (req, res) => {
  const { roomId, userId } = req.params;
  const roomData = roomMetadata.get(roomId);
  
  if (!roomData) {
    return res.status(404).json({ error: 'Room not found' });
  }
  
  // Check if user is in participants
  const participant = roomData.participants.get(userId);
  if (participant) {
    return res.json({
      found: true,
      user: participant,
      location: 'participants'
    });
  }
  
  // Check if user is in waiting list
  const waitingUser = roomData.waitingList.get(userId);
  if (waitingUser) {
    return res.json({
      found: true,
      user: waitingUser,
      location: 'waiting'
    });
  }
  
  // User not found
  return res.json({
    found: false,
    message: 'User not found in room'
  });
});

// Get all participants in room
app.get('/api/rooms/:roomId/participants', (req, res) => {
  const { roomId } = req.params;
  const roomData = roomMetadata.get(roomId);
  
  if (!roomData) {
    return res.status(404).json({ error: 'Room not found' });
  }
  
  const participants = Array.from(roomData.participants.values());
  res.json(participants);
});

// End room
app.post('/api/rooms/:roomId/end', async (req, res) => {
  try {
    const { roomId } = req.params;
    const roomData = roomMetadata.get(roomId);
    
    if (!roomData) {
      return res.status(404).json({ error: 'Room not found' });
    }
    
    // Delete room from Azure
    await roomsClient.deleteRoom(roomId);
    
    // Mark as inactive and remove from metadata
    roomData.isActive = false;
    roomMetadata.delete(roomId);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error ending room:', error);
    res.status(500).json({ error: 'Failed to end room' });
  }
});

// Leave room
app.post('/api/rooms/:roomId/leave/:userId', async (req, res) => {
  try {
    const { roomId, userId } = req.params;
    const roomData = roomMetadata.get(roomId);
    
    if (!roomData) {
      return res.status(404).json({ error: 'Room not found' });
    }
    
    // Check if user is in participants (need to remove from Azure room)
    const participant = roomData.participants.get(userId);
    if (participant) {
      // Remove from Azure room
      await roomsClient.removeParticipants(roomId, [
        { 
          communicationUserId: userId 
        }
      ]);
    }
    
    // Remove from our metadata
    roomData.participants.delete(userId);
    roomData.waitingList.delete(userId);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error leaving room:', error);
    res.status(500).json({ error: 'Failed to leave room' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
