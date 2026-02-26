import express from 'express';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
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

// Get video feed
router.get('/', (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  // Get current user ID from token if available
  let currentUserId: string | null = null;
  const token = req.cookies?.token;
  if (token) {
    try {
      const jwt = require('jsonwebtoken');
      const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      currentUserId = decoded.id;
    } catch (e) {
      // Invalid token, ignore
    }
  }

  const stmt = db.prepare(`
    SELECT videos.*, users.username, users.avatar,
    (SELECT COUNT(*) FROM likes WHERE video_id = videos.id) as like_count,
    EXISTS(SELECT 1 FROM likes WHERE video_id = videos.id AND user_id = ?) as liked_by_user
    FROM videos
    JOIN users ON videos.user_id = users.id
    ORDER BY videos.created_at DESC
    LIMIT ? OFFSET ?
  `);
  
  const videos = stmt.all(currentUserId, limit, offset);
  
  // Convert 1/0 to boolean for liked_by_user
  const videosWithBoolean = videos.map((v: any) => ({
    ...v,
    liked_by_user: Boolean(v.liked_by_user)
  }));

  res.json(videosWithBoolean);
});

// Upload video
router.post('/upload', authenticate, upload.single('video'), (req: AuthRequest, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No video file uploaded' });
  }

  const { description } = req.body;
  const id = uuidv4();
  const userId = req.user!.id;
  const url = `/uploads/${req.file.filename}`;

  try {
    const stmt = db.prepare('INSERT INTO videos (id, user_id, url, description) VALUES (?, ?, ?, ?)');
    stmt.run(id, userId, url, description);

    // Add earnings for upload (5 coins)
    const earningId = uuidv4();
    const earningStmt = db.prepare('INSERT INTO earnings (id, user_id, amount, type, source_id) VALUES (?, ?, ?, ?, ?)');
    earningStmt.run(earningId, userId, 5, 'upload', id);

    res.status(201).json({ message: 'Video uploaded', video: { id, url, description } });
  } catch (error) {
    res.status(500).json({ message: 'Failed to save video' });
  }
});

// Like video
router.post('/:id/like', authenticate, (req: AuthRequest, res) => {
  const videoId = req.params.id;
  const userId = req.user!.id;

  try {
    const checkStmt = db.prepare('SELECT * FROM likes WHERE user_id = ? AND video_id = ?');
    const existingLike = checkStmt.get(userId, videoId);

    if (existingLike) {
      const deleteStmt = db.prepare('DELETE FROM likes WHERE user_id = ? AND video_id = ?');
      deleteStmt.run(userId, videoId);
      // Note: We don't deduct earnings on unlike to prevent abuse/confusion, or we could if required.
      // For now, let's keep it simple and only reward likes.
      res.json({ message: 'Unliked', liked: false });
    } else {
      const insertStmt = db.prepare('INSERT INTO likes (user_id, video_id) VALUES (?, ?)');
      insertStmt.run(userId, videoId);

      // Add earnings for like (1 coin) to the video owner
      const videoStmt = db.prepare('SELECT user_id FROM videos WHERE id = ?');
      const video = videoStmt.get(videoId) as { user_id: string };
      
      if (video && video.user_id !== userId) { // Don't reward self-likes
        const earningId = uuidv4();
        const earningStmt = db.prepare('INSERT INTO earnings (id, user_id, amount, type, source_id) VALUES (?, ?, ?, ?, ?)');
        earningStmt.run(earningId, video.user_id, 1, 'like', videoId);
      }

      res.json({ message: 'Liked', liked: true });
    }
  } catch (error) {
    res.status(500).json({ message: 'Error toggling like' });
  }
});

// Get comments
router.get('/:id/comments', (req, res) => {
  const videoId = req.params.id;
  try {
    const stmt = db.prepare(`
      SELECT comments.*, users.username, users.avatar 
      FROM comments 
      JOIN users ON comments.user_id = users.id 
      WHERE video_id = ? 
      ORDER BY created_at DESC
    `);
    const comments = stmt.all(videoId);
    res.json(comments);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch comments' });
  }
});

// Add comment
router.post('/:id/comments', authenticate, (req: AuthRequest, res) => {
  const videoId = req.params.id;
  const userId = req.user!.id;
  const { text } = req.body;

  if (!text) return res.status(400).json({ message: 'Comment text required' });

  const id = uuidv4();
  try {
    const stmt = db.prepare('INSERT INTO comments (id, user_id, video_id, text) VALUES (?, ?, ?, ?)');
    stmt.run(id, userId, videoId, text);
    
    // Return the new comment with user details
    const newCommentStmt = db.prepare(`
      SELECT comments.*, users.username, users.avatar 
      FROM comments 
      JOIN users ON comments.user_id = users.id 
      WHERE comments.id = ?
    `);
    const newComment = newCommentStmt.get(id);
    
    res.status(201).json(newComment);
  } catch (error) {
    res.status(500).json({ message: 'Failed to post comment' });
  }
});

export default router;
