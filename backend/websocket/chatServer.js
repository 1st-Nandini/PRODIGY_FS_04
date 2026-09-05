import jwt from 'jsonwebtoken';
import { WebSocketServer } from 'ws';
import Message from '../models/Message.js';
import Room from '../models/Room.js';
import User from '../models/User.js';

const clients = new Map(); // userId -> Set<WebSocket>

function send(ws, payload) { if (ws.readyState === 1) ws.send(JSON.stringify(payload)); }
function broadcastPresence() {
  const online = [...clients.keys()];
  for (const sockets of clients.values()) for (const ws of sockets) send(ws, { type: 'presence', online });
}
function addClient(userId, ws) {
  if (!clients.has(userId)) clients.set(userId, new Set());
  clients.get(userId).add(ws);
}
function removeClient(userId, ws) {
  const sockets = clients.get(userId); if (!sockets) return;
  sockets.delete(ws); if (!sockets.size) clients.delete(userId);
}
function sendToUser(userId, payload) { for (const ws of clients.get(userId) || []) send(ws, payload); }
function sendToRoom(roomId, payload) {
  for (const [userId, sockets] of clients) {
    if (payload.excludeUserId && userId === payload.excludeUserId) continue;
    for (const ws of sockets) if (ws.currentRoomId === roomId) send(ws, payload);
  }
}

export function attachWebSocket(server) {
  const wss = new WebSocketServer({ server, path: '/ws' });
  wss.on('connection', async (ws, req) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      const token = url.searchParams.get('token');
      const payload = jwt.verify(token || '', process.env.JWT_SECRET);
      const user = await User.findById(payload.userId);
      if (!user) throw new Error('User not found');
      ws.userId = user._id.toString(); ws.currentRoomId = null;
      addClient(ws.userId, ws);
      user.online = true; user.lastSeen = new Date(); await user.save();
      send(ws, { type: 'connected', user: { id: user._id, username: user.username } });
      broadcastPresence();

      ws.on('message', async raw => {
        try {
          const data = JSON.parse(raw.toString());
          if (data.type === 'join-room') {
            const room = await Room.findById(data.roomId);
            if (!room) return send(ws, { type: 'error', message: 'Room not found.' });
            if (!room.members.some(id => id.toString() === ws.userId)) room.members.push(ws.userId);
            await room.save(); ws.currentRoomId = room._id.toString();
            send(ws, { type: 'room-joined', roomId: ws.currentRoomId });
          }
          if (data.type === 'leave-room') ws.currentRoomId = null;
          if (data.type === 'typing') sendToRoom(ws.currentRoomId, { type: 'typing', username: user.username, isTyping: !!data.isTyping, excludeUserId: ws.userId });
          if (data.type === 'room-message') {
            if (!ws.currentRoomId) return;
            const text = String(data.text || '').trim(); if (!text) return;
            const message = await Message.create({ sender: ws.userId, room: ws.currentRoomId, text });
            const populated = await message.populate('sender', 'username');
            sendToRoom(ws.currentRoomId, { type: 'message', message: populated });
          }
          if (data.type === 'private-message') {
            const recipient = await User.findById(data.recipientId);
            const text = String(data.text || '').trim(); if (!recipient || !text) return;
            const message = await Message.create({ sender: ws.userId, recipient: recipient._id, text });
            const populated = await message.populate('sender', 'username');
            const payloadMsg = { type: 'private-message', message: populated };
            send(ws, payloadMsg); sendToUser(recipient._id.toString(), payloadMsg);
            if (!recipient.online) sendToUser(ws.userId, { type: 'notification', message: `${recipient.username} is offline.` });
          }
        } catch (e) { send(ws, { type: 'error', message: 'Invalid message.' }); }
      });

      ws.on('close', async () => {
        removeClient(ws.userId, ws);
        if (!clients.has(ws.userId)) { await User.findByIdAndUpdate(ws.userId, { online: false, lastSeen: new Date() }); }
        broadcastPresence();
      });
    } catch { ws.close(1008, 'Unauthorized'); }
  });
  return wss;
}
