import express from 'express';
import Message from '../models/Message.js';
import Room from '../models/Room.js';
import { auth } from '../middleware/authMiddleware.js';

const router = express.Router();
router.use(auth);

router.get('/room/:roomId', async (req, res) => {
  const messages = await Message.find({ room: req.params.roomId }).populate('sender', 'username').sort({ createdAt: 1 }).limit(100);
  res.json({ messages });
});

router.get('/private/:userId', async (req, res) => {
  const messages = await Message.find({ $or: [
    { sender: req.user._id, recipient: req.params.userId },
    { sender: req.params.userId, recipient: req.user._id }
  ] }).populate('sender', 'username').sort({ createdAt: 1 }).limit(100);
  res.json({ messages });
});

export default router;
