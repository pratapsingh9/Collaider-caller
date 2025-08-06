// server.js

const { createServer } = require('http')
// import { WebSocketServer, WebSocket } from 'ws';
const {
    WebSocketServer , WebSocket
} = require('ws')
// import { v4 as uuidv4 } from 'uuid';
const {v4} =  require('uuid');

const PORT = process.env.PORT || 8080;

// We need a standard HTTP server to upgrade connections to WebSocket.
const server = createServer();

const wss = new WebSocketServer({ server });

const rooms = new Map();

console.log('wokring')

const broadcastToRoom = (roomId, message, excludeId) => {
    const room = rooms.get(roomId);
    if (!room) {
        return;
    }

    const messageString = JSON.stringify(message);

    room.forEach((client) => {
        if (client.readyState === WebSocket.OPEN && client.id !== excludeId) {
            client.send(messageString);
        }
    });
};

// --- WebSocket Server Logic ---

wss.on('connection', (ws) => {
    // Assign a unique ID to each client upon connection.
    ws.id = v4();
    console.log(`[Server] Client connected: ${ws.id}`);

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message.toString());
            const { type, payload } = data;
            const roomId = ws.roomId; // The room this client is currently in.

            switch (type) {
                // When a user wants to join a room
                case 'JOIN_ROOM': {
                    const { roomId: newRoomId, username } = payload;
                    ws.roomId = newRoomId;
                    ws.username = username;

                    // If the room doesn't exist, create it.
                    if (!rooms.has(newRoomId)) {
                        rooms.set(newRoomId, new Set());
                    }

                    // Get the list of existing participants BEFORE adding the new one.
                    const room = rooms.get(newRoomId);
                    const existingParticipants = Array.from(room).map(client => ({
                        id: client.id,
                        username: client.username,
                    }));
                    
                    // Add the new client to the room.
                    room.add(ws);
                    console.log(`[Server] Client ${ws.id} (${ws.username}) joined room ${newRoomId}`);

                    // 1. Send the list of existing participants to the new client.
                    ws.send(JSON.stringify({
                        type: 'EXISTING_PARTICIPANTS',
                        payload: { participants: existingParticipants },
                    }));

                    // 2. Notify all other clients in the room that a new participant has joined.
                    broadcastToRoom(newRoomId, {
                        type: 'NEW_PARTICIPANT',
                        payload: { id: ws.id, username: ws.username },
                    }, ws.id); // Exclude the sender
                    
                    break;
                }

                case 'SIGNAL': {
                    const { to, signal } = payload;
                    const room = rooms.get(roomId);
                    if (room) {
                        const targetClient = Array.from(room).find(client => client.id === to);
                        if (targetClient && targetClient.readyState === WebSocket.OPEN) {
                             // Forward the signal, but add who it's from.
                            targetClient.send(JSON.stringify({
                                type: 'SIGNAL',
                                payload: { from: ws.id, signal },
                            }));
                        }
                    }
                    break;
                }
                
                // For broadcasting chat messages
                case 'SEND_MESSAGE': {
                    const { text } = payload;
                    broadcastToRoom(roomId, {
                        type: 'NEW_MESSAGE',
                        payload: {
                            id: uuidv4(),
                            senderId: ws.id,
                            senderName: ws.username,
                            text,
                        },
                    });
                    break;
                }

                // For broadcasting mute/video state changes
                case 'STATE_CHANGE': {
                    const { type, status } = payload; // e.g., type: 'audio', status: true
                     broadcastToRoom(roomId, {
                        type: 'PARTICIPANT_STATE_CHANGED',
                        payload: {
                            participantId: ws.id,
                            state: { [type]: status } // e.g., { audio: true } or { video: false }
                        },
                    }, ws.id); // Exclude the sender
                    break;
                }
            }
        } catch (error) {
            console.error('[Server] Failed to handle message:', error);
        }
    });

    ws.on('close', () => {
        const { id, roomId, username } = ws;
        console.log(`[Server] Client disconnected: ${id}`);
        
        const room = rooms.get(roomId);
        if (room) {
            // Remove the client from the room.
            room.delete(ws);
            console.log(`[Server] Client ${id} removed from room ${roomId}`);

            // Notify remaining clients that this participant has left.
            broadcastToRoom(roomId, {
                type: 'PARTICIPANT_LEFT',
                payload: { id },
            });

            // If the room is now empty, delete it to clean up memory.
            if (room.size === 0) {
                rooms.delete(roomId);
                console.log(`[Server] Room ${roomId} is empty and has been deleted.`);
            }
        }
    });

    ws.on('error', (error) => {
        console.error(`[Server] WebSocket error for client ${ws.id}:`, error);
    });
});

// Start the server
server.listen(PORT, () => {
    console.log(`🚀 WebSocket server is running on ws://localhost:${PORT}`);
});