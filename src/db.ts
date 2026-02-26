import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

const dbPath = path.join(process.cwd(), 'reelflow.db');
const db = new Database(dbPath);

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE,
    mobile TEXT,
    age INTEGER,
    password TEXT NOT NULL,
    avatar TEXT,
    bio TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS videos (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    url TEXT NOT NULL,
    description TEXT,
    likes INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS likes (
    user_id TEXT NOT NULL,
    video_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, video_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (video_id) REFERENCES videos(id)
  );
  
  CREATE TABLE IF NOT EXISTS earnings (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    amount INTEGER NOT NULL,
    type TEXT NOT NULL, -- 'upload', 'like', 'view'
    source_id TEXT, -- video_id
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS withdrawals (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    amount INTEGER NOT NULL,
    upi_id TEXT NOT NULL,
    status TEXT DEFAULT 'pending', -- 'pending', 'completed'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS follows (
    follower_id TEXT NOT NULL,
    following_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (follower_id, following_id),
    FOREIGN KEY (follower_id) REFERENCES users(id),
    FOREIGN KEY (following_id) REFERENCES users(id)
  );
`);

// Seed Data
try {
  const userCount = db.prepare('SELECT count(*) as count FROM users').get() as { count: number };

  if (userCount.count === 0) {
    console.log('Seeding sample data...');
    const userId = uuidv4();
    const password = bcrypt.hashSync('password123', 10);
    
    const insertUser = db.prepare(`
      INSERT INTO users (id, username, email, mobile, age, password, bio, avatar)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    insertUser.run(
      userId, 
      'ReelKamaiOfficial', 
      'team@reelkamai.com', 
      '1234567890', 
      25, 
      password, 
      'Welcome to ReelKamai! Enjoy these sample videos.',
      'https://ui-avatars.com/api/?name=ReelKamai&background=random'
    );

    const videos = [
      {
        url: 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
        description: 'Big Buck Bunny - A classic open movie project.'
      },
      {
        url: 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
        description: 'Elephants Dream - The world\'s first open movie.'
      },
      {
        url: 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
        description: 'For Bigger Blazes - Google Cast sample.'
      },
      {
        url: 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
        description: 'For Bigger Escapes - Adventure awaits.'
      },
       {
        url: 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
        description: 'For Bigger Fun - Enjoy the moment.'
      }
    ];

    const insertVideo = db.prepare(`
      INSERT INTO videos (id, user_id, url, description)
      VALUES (?, ?, ?, ?)
    `);

    videos.forEach(video => {
      insertVideo.run(uuidv4(), userId, video.url, video.description);
    });
    
    console.log('Sample data seeded successfully.');
  }
} catch (error) {
  console.error('Error seeding data:', error);
}

export default db;
