import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import db from '../db';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';
const GAS_URL = 'https://script.google.com/macros/s/AKfycbyhyYhqkuxvbrJYDmr0yriUYsZikC9PFj0cvbTbwFod55BGOROLdYW4Cn4qBKhfuu_d/exec';

router.post('/signup', async (req, res) => {
  const { username, email, mobile, age, password } = req.body;

  if (!username || !email || !mobile || !age || !password) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    // 1. Register user in Google Sheet via GAS
    const gasResponse = await fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'register',
        username,
        email,
        mobile,
        age,
        password // Note: Sending plain password to GAS as requested, but hashing locally
      })
    });

    const gasData = await gasResponse.json();

    if (gasData.result !== 'success') {
      return res.status(400).json({ message: gasData.message || 'Registration failed on Google Sheet' });
    }

    // 2. Register user in local SQLite DB (to ensure app functionality works)
    // We use the same UUID if GAS returned one, or generate one. 
    // GAS script provided earlier generates a UUID.
    // If GAS doesn't return the ID, we generate one.
    const id = uuidv4(); 
    const hashedPassword = await bcrypt.hash(password, 10);

    const stmt = db.prepare('INSERT INTO users (id, username, email, mobile, age, password) VALUES (?, ?, ?, ?, ?, ?)');
    stmt.run(id, username, email, mobile, age, hashedPassword);

    // 3. Auto-login
    const token = jwt.sign({ id, username }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production' });
    
    res.status(201).json({ message: 'User created', user: { id, username } });

  } catch (error: any) {
    console.error('Signup Error:', error);
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
       // If it failed locally but succeeded in GAS, it's a sync issue. 
       // We'll just report the local error.
      if (error.message.includes('users.username')) {
        return res.status(409).json({ message: 'Username already exists' });
      }
      if (error.message.includes('users.email')) {
        return res.status(409).json({ message: 'Email already exists' });
      }
      return res.status(409).json({ message: 'User already exists' });
    }
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/login', async (req, res) => {
  const { identifier, password } = req.body; // identifier can be username or email

  try {
    // 1. Authenticate via Google Sheet
    const gasResponse = await fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'login',
        identifier,
        password
      })
    });

    const gasData = await gasResponse.json();

    if (gasData.result !== 'success') {
      return res.status(401).json({ message: gasData.message || 'Invalid credentials from Google Sheet' });
    }

    const gasUser = gasData.user;

    // 2. Ensure user exists locally (Sync)
    // We need to find the user in local DB to get their local ID (or use the one from GAS if we synced it)
    // Since we can't trust the ID from GAS matches local unless we inserted it, we search by username/email.
    
    const stmt = db.prepare('SELECT * FROM users WHERE username = ? OR email = ?');
    let localUser = stmt.get(gasUser.username, gasUser.email) as any;

    if (!localUser) {
      // User exists in Sheet but not locally (e.g. registered via Sheet directly or before sync)
      // We must create them locally to allow foreign keys (videos, likes) to work.
      const id = uuidv4(); // Or gasUser.id if we trust it to be unique and consistent
      // We need to hash the password for local consistency, even though we validated via GAS
      const hashedPassword = await bcrypt.hash(password, 10);
      
      const insertStmt = db.prepare('INSERT INTO users (id, username, email, mobile, age, password) VALUES (?, ?, ?, ?, ?, ?)');
      insertStmt.run(id, gasUser.username, gasUser.email, gasUser.mobile || '', gasUser.age || 0, hashedPassword);
      
      localUser = { id, username: gasUser.username };
    }

    // 3. Generate Token
    const token = jwt.sign({ id: localUser.id, username: localUser.username }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production' });
    
    res.json({ message: 'Logged in', user: { id: localUser.id, username: localUser.username } });

  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out' });
});

router.get('/me', (req, res) => {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ message: 'Unauthorized' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    res.json({ user: decoded });
  } catch (err) {
    res.status(401).json({ message: 'Invalid token' });
  }
});

export default router;
