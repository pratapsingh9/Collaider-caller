// server.js
// You need to install the 'ws' package: npm install ws
const { WebSocketServer, WebSocket } = require('ws');
const { createServer } = require('http');
const { v4: uuidv4 } = require('uuid');

const PORT = process.env.PORT || 8080;

// A standard HTTP server is used to host the WebSocket server.
const server = createServer();
const wss = new WebSocketServer({ server });

// This Map stores all the active rooms. The key is the roomId.
// The value is a Set of connected WebSocket clients in that room.
const rooms = new Map();

/**
 * Broadcasts a message to all clients in a specific room, with an option to exclude one client.
 * @param {string} roomId - The ID of the room.
 * @param {object} message - The message object to send.
 * @param {string} [excludeId] - The ID of a client to exclude from the broadcast.
 */
const broadcastToRoom = (roomId, message, excludeId) => {
    const room = rooms.get(roomId);
    if (!room) {
        console.warn(`[Server] Attempted to broadcast to non-existent room: ${roomId}`);
        return;
    }

    const messageString = JSON.stringify(message);

    room.forEach((client) => {
        // Check if the client is connected and not the one to be excluded.
        if (client.readyState === WebSocket.OPEN && client.id !== excludeId) {
            client.send(messageString);
        }
    });
};

// --- WebSocket Server Main Logic ---

wss.on('connection', (ws) => {
    // Assign a unique ID to each client.
    ws.id = uuidv4();
    console.log(`[Server] Client connected: ${ws.id}`);

    // Handle incoming messages from clients.
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message.toString());
            const { type, payload } = data;
            const roomId = ws.roomId; // The room this client is currently in.

            switch (type) {
                // When a user first joins a room.
                case 'JOIN_ROOM': {
                    const { roomId: newRoomId, username } = payload;
                    ws.roomId = newRoomId;
                    ws.username = username;

                    // If the room doesn't exist, create it.
                    if (!rooms.has(newRoomId)) {
                        rooms.set(newRoomId, new Set());
                    }

                    const room = rooms.get(newRoomId);
                    const existingParticipants = Array.from(room).map(client => ({ id: client.id, username: client.username }));
                    
                    // Add the new client to the room.
                    room.add(ws);
                    console.log(`[Server] Client ${ws.id} (${ws.username}) joined room ${newRoomId}`);

                    // 1. Send the list of existing participants to the new client.
                    ws.send(JSON.stringify({
                        type: 'EXISTING_PARTICIPANTS',
                        payload: { participants: existingParticipants, selfId: ws.id },
                    }));

                    // 2. Notify all other clients that a new user has joined.
                    broadcastToRoom(newRoomId, {
                        type: 'NEW_PARTICIPANT',
                        payload: { id: ws.id, username: ws.username },
                    }, ws.id);
                    
                    break;
                }

                // For relaying WebRTC signaling messages (offers, answers, ICE candidates).
                case 'SIGNAL': {
                    const { to, signal } = payload;
                    const room = rooms.get(roomId);
                    if (room) {
                        const targetClient = Array.from(room).find(client => client.id === to);
                        if (targetClient && targetClient.readyState === WebSocket.OPEN) {
                            // Forward the signal, adding who it's from.
                            targetClient.send(JSON.stringify({
                                type: 'SIGNAL',
                                payload: { from: ws.id, signal },
                            }));
                        }
                    }
                    break;
                }
                
                // For broadcasting chat messages.
                case 'SEND_MESSAGE': {
                    broadcastToRoom(roomId, {
                        type: 'NEW_MESSAGE',
                        payload: {
                            id: uuidv4(),
                            senderId: ws.id,
                            senderName: ws.username,
                            text: payload.text,
                            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        },
                    });
                    break;
                }

                // For broadcasting mute/video state changes.
                case 'STATE_CHANGE': {
                    broadcastToRoom(roomId, {
                        type: 'PARTICIPANT_STATE_CHANGED',
                        payload: {
                            participantId: ws.id,
                            state: payload.state, // e.g., { isMuted: true }
                        },
                    }, ws.id);
                    break;
                }
            }
        } catch (error) {
            console.error('[Server] Failed to handle message:', error);
        }
    });

    // Handle client disconnection.
    ws.on('close', () => {
        const { id, roomId } = ws;
        console.log(`[Server] Client disconnected: ${id}`);
        
        const room = rooms.get(roomId);
        if (room) {
            room.delete(ws);
            console.log(`[Server] Client ${id} removed from room ${roomId}`);

            // Notify remaining clients that this participant has left.
            broadcastToRoom(roomId, { type: 'PARTICIPANT_LEFT', payload: { id } });

            // If the room is now empty, delete it.
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

// Start the server.
server.listen(PORT, () => {
    console.log(`🚀 WebSocket server is running on ws://localhost:${PORT}`);
});
