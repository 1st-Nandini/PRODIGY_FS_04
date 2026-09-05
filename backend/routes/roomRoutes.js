import express from 'express';
import Room from '../models/Room.js';
import User from '../models/User.js';
import { auth } from '../middleware/authMiddleware.js';

const router = express.Router();
router.use(auth);

router.get('/', async (req, res) => {
  const rooms = await Room.find().populate('createdBy', 'username').sort({ createdAt: -1 });
  res.json({ rooms });
});

router.post('/', async (req, res) => {
  try {
    const name = req.body.name?.trim();
    if (!name) return res.status(400).json({ message: 'Room name is required.' });
    const room = await Room.create({ name, members: [req.user._id], createdBy: req.user._id });
    res.status(201).json({ room });
  } catch (e) {
    res.status(e.code === 11000 ? 409 : 500).json({ message: e.code === 11000 ? 'Room already exists.' : 'Could not create room.' });
  }
});

router.post('/:id/join', async (req, res) => {
  const room = await Room.findByIdAndUpdate(req.params.id, { $addToSet: { members: req.user._id } }, { new: true });
  if (!room) return res.status(404).json({ message: 'Room not found.' });
  res.json({ room });
});

router.get('/users/all', async (req, res) => {
  const users = await User.find({ _id: { $ne: req.user._id } }).select('username email online lastSeen').sort('username');
  res.json({ users });
});

export default router;
