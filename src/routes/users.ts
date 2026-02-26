import express from 'express';
import multer from 'multer';
import path from 'path';
import db from '../db';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

// Search users
router.get('/search', (req, res) => {
  const { q } = req.query;
  if (!q || typeof q !== 'string') {
    return res.json([]);
  }

  try {
    const stmt = db.prepare('SELECT id, username, avatar FROM users WHERE username LIKE ? LIMIT 10');
    const users = stmt.all(`%${q}%`);
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Search failed' });
  }
});

// Get user profile
router.get('/:username', (req, res) => {
  const { username } = req.params;

  try {
    const userStmt = db.prepare('SELECT id, username, avatar, bio FROM users WHERE username = ?');
    const user = userStmt.get(username) as any;

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const videosStmt = db.prepare('SELECT * FROM videos WHERE user_id = ? ORDER BY created_at DESC');
    const videos = videosStmt.all(user.id);

    res.json({ user, videos });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update profile
router.put('/me', authenticate, upload.single('avatar'), (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const { bio } = req.body;
  const avatar = req.file ? `/uploads/${req.file.filename}` : undefined;

  try {
    if (avatar) {
      const stmt = db.prepare('UPDATE users SET bio = ?, avatar = ? WHERE id = ?');
      stmt.run(bio, avatar, userId);
    } else {
      const stmt = db.prepare('UPDATE users SET bio = ? WHERE id = ?');
      stmt.run(bio, userId);
    }
    
    // Return updated user
    const userStmt = db.prepare('SELECT id, username, avatar, bio FROM users WHERE id = ?');
    const updatedUser = userStmt.get(userId);
    
    res.json({ message: 'Profile updated', user: updatedUser });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update profile' });
  }
});

// Export users to CSV (Admin only - for now accessible to authenticated users for demo)
router.get('/export/csv', authenticate, (req: AuthRequest, res) => {
  try {
    const stmt = db.prepare('SELECT id, username, email, mobile, age, created_at FROM users');
    const users = stmt.all();

    // CSV Header
    let csv = 'ID,Username,Email,Mobile,Age,Joined Date\n';

    // CSV Rows
    users.forEach((user: any) => {
      const joinedDate = new Date(user.created_at).toISOString().split('T')[0];
      // Escape fields that might contain commas
      const username = `"${user.username.replace(/"/g, '""')}"`;
      const email = `"${user.email.replace(/"/g, '""')}"`;
      
      csv += `${user.id},${username},${email},${user.mobile},${user.age},${joinedDate}\n`;
    });

    res.header('Content-Type', 'text/csv');
    res.attachment('users_export.csv');
    res.send(csv);
  } catch (error) {
    console.error('Export failed:', error);
    res.status(500).json({ message: 'Export failed' });
  }
});

export default router;
