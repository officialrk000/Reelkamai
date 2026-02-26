import React, { useRef, useEffect, useState } from 'react';
import { Heart, MessageCircle, Share2, Play, Pause, Volume2, VolumeX } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import clsx from 'clsx';
import CommentsModal from './CommentsModal';
import { doc, updateDoc, arrayUnion, arrayRemove, increment, collection, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';

interface VideoPlayerProps {
  video: {
    id: string;
    url: string;
    description: string;
    username: string;
    userId?: string; // Optional userId
    like_count: number;
    avatar?: string;
    liked_by_user?: boolean;
  };
  isActive: boolean;
  preload: 'auto' | 'metadata' | 'none';
  onEnded?: () => void;
}

const VideoPlayer = React.memo(function VideoPlayer({ video, isActive, preload, onEnded }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  // ... (rest of the component logic)

  // ... (return statement)
}, (prevProps, nextProps) => {
  return (
    prevProps.isActive === nextProps.isActive &&
    prevProps.preload === nextProps.preload &&
    prevProps.video.id === nextProps.video.id &&
    prevProps.video.like_count === nextProps.video.like_count &&
    prevProps.video.liked_by_user === nextProps.video.liked_by_user
  );
});

export default VideoPlayer;
