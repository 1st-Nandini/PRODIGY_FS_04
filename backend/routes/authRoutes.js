import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { auth } from '../middleware/authMiddleware.js';

const router = express.Router();
const makeToken = userId => jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });

router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) return res.status(400).json({ message: 'Username, email and password are required.' });
    if (password.length < 8) return res.status(400).json({ message: 'Password must be at least 8 characters.' });
    const exists = await User.findOne({ $or: [{ email: email.toLowerCase() }, { username }] });
    if (exists) return res.status(409).json({ message: 'Username or email already exists.' });
    const hashed = await bcrypt.hash(password, 12);
    const user = await User.create({ username, email: email.toLowerCase(), password: hashed });
    res.status(201).json({ token: makeToken(user._id.toString()), user: { id: user._id, username: user.username, email: user.email } });
  } catch (e) { res.status(500).json({ message: 'Registration failed.', error: e.message }); }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: email?.toLowerCase() });
    if (!user || !(await bcrypt.compare(password || '', user.password))) return res.status(401).json({ message: 'Invalid email or password.' });
    user.online = true; user.lastSeen = new Date(); await user.save();
    res.json({ token: makeToken(user._id.toString()), user: { id: user._id, username: user.username, email: user.email } });
  } catch (e) { res.status(500).json({ message: 'Login failed.', error: e.message }); }
});

router.get('/me', auth, (req, res) => res.json({ user: req.user }));

router.post('/logout', auth, async (req, res) => {
  req.user.online = false; req.user.lastSeen = new Date(); await req.user.save();
  res.json({ message: 'Logged out.' });
});

export default router;
