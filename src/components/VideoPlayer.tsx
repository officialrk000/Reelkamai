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

export default function VideoPlayer({ video, isActive, preload, onEnded }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [liked, setLiked] = useState(!!video.liked_by_user);
  const [likeCount, setLikeCount] = useState(video.like_count);
  const [showComments, setShowComments] = useState(false);
  const [showOverlayIcon, setShowOverlayIcon] = useState(false);
  const [overlayIconType, setOverlayIconType] = useState<'play' | 'pause' | 'mute' | 'unmute'>('play');
  const [isMuted, setIsMuted] = useState(true); // Default to muted for autoplay policy
  const [isHovering, setIsHovering] = useState(false);
  const [error, setError] = useState(false);
  const { user } = useAuth();

  const [commentCount, setCommentCount] = useState(0);

  useEffect(() => {
    // Reset error state when video changes
    setError(false);
    if (videoRef.current) {
      videoRef.current.load();
    }
  }, [video.id, video.url]);

  useEffect(() => {
    const fetchCommentCount = async () => {
      try {
        const commentsRef = collection(db, 'videos', video.id, 'comments');
        const snapshot = await getDocs(commentsRef);
        setCommentCount(snapshot.size);
      } catch (err: any) {
        console.error('Failed to fetch comment count', err);
        if (err.code === 'permission-denied') {
          // Silently fail or set to 0 in demo mode
          setCommentCount(0);
        }
      }
    };
    fetchCommentCount();
  }, [video.id]);

  useEffect(() => {
    if (isActive) {
      if (videoRef.current) {
        videoRef.current.muted = isMuted;
        videoRef.current.play().catch(() => {
          setIsPlaying(false);
          // If autoplay fails, it might be due to unmuted autoplay.
          // We keep it muted by default.
        });
      }
      setIsPlaying(true);
    } else {
      videoRef.current?.pause();
      if (videoRef.current) {
        videoRef.current.currentTime = 0;
      }
      setIsPlaying(false);
    }
  }, [isActive]);

  // Sync mute state when it changes
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
    }
  }, [isMuted]);

  const togglePlay = () => {
    if (videoRef.current?.paused) {
      videoRef.current.play();
      setIsPlaying(true);
      setOverlayIconType('play');
    } else {
      videoRef.current?.pause();
      setIsPlaying(false);
      setOverlayIconType('pause');
    }
    
    // Show overlay icon briefly
    setShowOverlayIcon(true);
    setTimeout(() => setShowOverlayIcon(false), 600);
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent toggling play/pause
    setIsMuted(!isMuted);
    setOverlayIconType(isMuted ? 'unmute' : 'mute');
    setShowOverlayIcon(true);
    setTimeout(() => setShowOverlayIcon(false), 600);
  };

  const handleLike = async () => {
    if (!user) {
      alert('Please login to like videos');
      return;
    }

    const newLikedState = !liked;
    setLiked(newLikedState);
    setLikeCount(prev => newLikedState ? prev + 1 : prev - 1);
    
    try {
      const videoRef = doc(db, 'videos', video.id);
      if (newLikedState) {
        await updateDoc(videoRef, {
          likes: arrayUnion(user.id),
          likeCount: increment(1)
        });

        // Award 5 coins to the video owner (if it's not the user themselves)
        // Skip for demo users or if userId is missing
        if (video.userId && video.userId !== user.id && !video.userId.startsWith('demo-user')) {
           try {
             const ownerRef = doc(db, 'users', video.userId);
             // Use setDoc with merge to prevent "No document to update" errors if user doc is missing
             // although it should exist for real users.
             await updateDoc(ownerRef, {
               coins: increment(5)
             });
             
             // Add to owner's earnings history
             await addDoc(collection(db, 'users', video.userId, 'earnings'), {
               amount: 5,
               type: 'like',
               createdAt: serverTimestamp()
             });
           } catch (coinErr) {
             console.warn("Failed to award coins:", coinErr);
             // Do not block the like action if coin award fails
           }
        }

      } else {
        await updateDoc(videoRef, {
          likes: arrayRemove(user.id),
          likeCount: increment(-1)
        });
      }
    } catch (err: any) {
      console.error('Failed to like video', err);
      // Revert state on error
      setLiked(!newLikedState);
      setLikeCount(prev => newLikedState ? prev - 1 : prev + 1);
      
      if (err.code === 'permission-denied') {
        alert("Action failed: Firebase permissions denied. You are in Demo Mode.");
      }
    }
  };

  const handleShare = async () => {
    const shareData = {
      title: `Check out this video by @${video.username}`,
      text: video.description,
      url: `${window.location.origin}/video/${video.id}`, // Use a clean URL structure
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        console.error('Error sharing:', err);
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareData.url);
        alert('Link copied to clipboard!');
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    }
  };

  return (
    <div 
      className="relative w-full h-full bg-black snap-start shrink-0 group"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <video
        ref={videoRef}
        src={video.url}
        className="w-full h-full object-cover"
        loop
        playsInline
        crossOrigin="anonymous" // Added for CORS support
        muted={isMuted}
        preload={preload}
        onClick={togglePlay}
        onEnded={onEnded}
        onError={(e) => {
          console.error("Video playback error:", e.currentTarget.error, video.url);
          setError(true);
        }}
        // Explicitly remove controls
        controls={false}
      />

      {/* Error Fallback */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 z-10">
          <p className="text-red-400 font-bold mb-2">⚠️ Video Error</p>
          <p className="text-gray-400 text-xs px-6 text-center mb-4">
            This video could not be played. It might be deleted or restricted.
          </p>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setError(false);
              if (videoRef.current) {
                videoRef.current.load();
                videoRef.current.play().catch(console.error);
              }
            }} 
            className="px-4 py-2 bg-gray-800 rounded-lg text-xs font-bold hover:bg-gray-700"
          >
            Retry
          </button>
        </div>
      )}

      {/* Play/Pause/Mute Overlay Animation */}
      <AnimatePresence>
        {showOverlayIcon && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1.2 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none z-20"
          >
            <div className="bg-black/50 p-6 rounded-full backdrop-blur-md">
              {overlayIconType === 'play' && <Play size={48} fill="white" className="text-white ml-1" />}
              {overlayIconType === 'pause' && <Pause size={48} fill="white" className="text-white" />}
              {overlayIconType === 'mute' && <VolumeX size={48} className="text-white" />}
              {overlayIconType === 'unmute' && <Volume2 size={48} className="text-white" />}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Persistent Play Icon when paused (if not animating) */}
      {!isPlaying && !showOverlayIcon && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="bg-black/30 p-4 rounded-full backdrop-blur-sm">
            <Play size={32} fill="white" className="text-white/80 ml-1" />
          </div>
        </div>
      )}

      {/* Mute Button - Always visible for better UX */}
      <div className="absolute top-20 right-4 z-30">
        <button 
          onClick={toggleMute}
          className="p-2 rounded-full bg-black/40 backdrop-blur-sm hover:bg-black/60 text-white"
        >
          {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
        </button>
      </div>

      {/* Right Sidebar Actions */}
      <div className="absolute right-4 bottom-24 flex flex-col items-center gap-5 z-30">
        <div className="flex flex-col items-center gap-1">
          <button 
            onClick={handleLike}
            className="p-2.5 rounded-full bg-black/20 backdrop-blur-sm active:scale-90 transition-transform hover:bg-black/40"
          >
            <Heart 
              size={24} 
              className={clsx("transition-colors", liked ? "fill-red-500 text-red-500" : "text-white")} 
            />
          </button>
          <span className="text-white text-xs font-medium drop-shadow-md">{likeCount}</span>
        </div>

        <div className="flex flex-col items-center gap-1">
          <button 
            onClick={() => setShowComments(true)}
            className="p-2.5 rounded-full bg-black/20 backdrop-blur-sm active:scale-90 transition-transform hover:bg-black/40"
          >
            <MessageCircle size={24} className="text-white" />
          </button>
          <span className="text-white text-xs font-medium drop-shadow-md">{commentCount}</span>
        </div>

        <button 
          onClick={handleShare}
          className="p-2.5 rounded-full bg-black/20 backdrop-blur-sm active:scale-90 transition-transform hover:bg-black/40"
        >
          <Share2 size={24} className="text-white" />
        </button>
      </div>

      {/* Bottom Info with Enhanced Visibility */}
      <div className="absolute bottom-0 left-0 right-0 z-20 p-4 pb-6 bg-gradient-to-t from-black/90 via-black/40 to-transparent pt-24">
        <Link to={`/profile/${video.username}`} className="flex items-center gap-3 mb-3 w-fit">
          <div className="w-10 h-10 rounded-full bg-gray-700 overflow-hidden border-2 border-white/20 shadow-md">
            {video.avatar ? (
              <img src={video.avatar} alt={video.username} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600 text-sm font-bold text-white">
                {video.username[0].toUpperCase()}
              </div>
            )}
          </div>
          <span className="font-bold text-white text-lg drop-shadow-lg tracking-wide">@{video.username}</span>
        </Link>
        <p className="text-white/90 text-sm drop-shadow-md line-clamp-2 font-medium leading-relaxed pr-12">
          {video.description}
        </p>
      </div>

      {/* Comments Modal */}
      <AnimatePresence>
        {showComments && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
              onClick={() => setShowComments(false)}
            />
            <CommentsModal videoId={video.id} onClose={() => setShowComments(false)} />
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
