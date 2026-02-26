import React, { useEffect, useState, useRef, useCallback } from 'react';
import VideoPlayer from '../components/VideoPlayer';
import VideoSkeleton from '../components/VideoSkeleton';
import { collection, query, orderBy, limit, getDocs, startAfter, QueryDocumentSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';

interface Video {
  id: string;
  url: string;
  description: string;
  username: string;
  userId?: string; // Optional userId
  like_count: number;
  avatar?: string;
  liked_by_user?: boolean;
}

const VideoWrapper = React.memo(({ video, index, activeIndex, handleVideoEnded }: { video: Video, index: number, activeIndex: number, handleVideoEnded: () => void }) => (
  <div 
    key={`${video.id}-${index}`} 
    data-index={index}
    className="video-container h-full w-full snap-start"
  >
    <VideoPlayer 
      video={video} 
      isActive={index === activeIndex}
      preload={Math.abs(index - activeIndex) <= 2 ? 'auto' : 'none'}
      onEnded={handleVideoEnded}
    />
  </div>
), (prev, next) => {
  return (
    prev.video.id === next.video.id &&
    prev.index === next.index &&
    prev.activeIndex === next.activeIndex
  );
});

export default function Feed() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  const { user } = useAuth();

  const seedSampleVideos = async () => {
    console.log("Seeding initiated");
  };

  const loadVideos = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    setError(null);
    try {
      let q = query(
        collection(db, 'videos'),
        orderBy('createdAt', 'desc'),
        limit(5)
      );

      if (lastDoc) {
        q = query(
          collection(db, 'videos'),
          orderBy('createdAt', 'desc'),
          startAfter(lastDoc),
          limit(5)
        );
      }

      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        setHasMore(false);
      } else {
        const newVideos = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            url: data.url,
            description: data.description,
            username: data.username,
            userId: data.userId, // Map userId
            like_count: data.likeCount || 0,
            avatar: data.avatar,
            liked_by_user: user ? (data.likes || []).includes(user.id) : false
          };
        });

        setVideos(prev => [...prev, ...newVideos]);
        setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
      }
    } catch (err: any) {
      console.warn('Firebase load failed, switching to demo mode:', err.code);
      
      // Fallback to local sample videos if Firebase fails
      const sampleVideos: Video[] = [
        {
          id: 'local-1',
          url: 'https://assets.mixkit.co/videos/preview/mixkit-girl-in-neon-sign-1232-large.mp4',
          description: 'Neon vibes only! 🌃✨ #citylife #neon (Demo Mode)',
          username: 'neon_dreamer',
          userId: 'demo-user-1', // Add dummy userId
          like_count: 120,
          avatar: 'https://ui-avatars.com/api/?name=Neon+Dreamer&background=random',
          liked_by_user: false
        },
        {
          id: 'local-2',
          url: 'https://assets.mixkit.co/videos/preview/mixkit-tree-with-yellow-flowers-1173-large.mp4',
          description: 'Nature is beautiful 🌸 #nature #flowers (Demo Mode)',
          username: 'nature_lover',
          userId: 'demo-user-2', // Add dummy userId
          like_count: 85,
          avatar: 'https://ui-avatars.com/api/?name=Nature+Lover&background=random',
          liked_by_user: false
        }
      ];
      setVideos(sampleVideos);
      setDemoMode(true);
      setHasMore(false);

      if (err.code === 'permission-denied') {
        setError("⚠️ Demo Mode Active: Firebase permissions are missing. Update Firestore Rules to enable real data.");
      } else if (err.message && err.message.includes('app-check')) {
        setError("⚠️ Demo Mode Active: App Check is blocking access.");
      }
    } finally {
      setLoading(false);
    }
  }, [lastDoc, loading, hasMore, user]);

  // Initial load
  useEffect(() => {
    // Only load if empty to prevent duplicate loads on strict mode or re-renders
    if (videos.length === 0) {
      loadVideos();
    }
  }, []);

  // Intersection Observer for active video detection
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = Number(entry.target.getAttribute('data-index'));
            setActiveIndex(index);
            
            // Load more videos when approaching the end
            // Trigger earlier (3 videos before end) to ensure smoother infinite scroll
            if (index >= videos.length - 3 && hasMore && !loading) {
              loadVideos();
            }
          }
        });
      },
      {
        root: container,
        threshold: 0.6, // Video is considered active when 60% visible
      }
    );

    const elements = container.querySelectorAll('.video-container');
    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [videos, loadVideos]);

  // Handle auto-scroll to next video on end
  const handleVideoEnded = useCallback(() => {
    if (activeIndex < videos.length - 1) {
      const nextVideo = containerRef.current?.children[activeIndex + 1];
      nextVideo?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeIndex, videos.length]);

  return (
    <div 
      ref={containerRef} 
      className="h-full w-full overflow-y-scroll snap-y snap-mandatory scroll-smooth no-scrollbar"
      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
    >
      {error && (
        <div className="p-3 bg-yellow-900/40 border border-yellow-600/50 text-yellow-200 m-4 rounded-lg text-xs flex items-center justify-between backdrop-blur-sm">
          <span>{error}</span>
          <button 
            onClick={() => window.location.reload()}
            className="ml-2 px-3 py-1 bg-yellow-800/50 rounded hover:bg-yellow-700/50 text-white border border-yellow-500/30"
          >
            Retry
          </button>
        </div>
      )}

      {videos.map((video, index) => (
        <VideoWrapper 
          key={`${video.id}-${index}`}
          video={video}
          index={index}
          activeIndex={activeIndex}
          handleVideoEnded={handleVideoEnded}
        />
      ))}
      
      {loading && (
        <div className="h-full w-full snap-start">
          <VideoSkeleton />
        </div>
      )}
      
      {!loading && videos.length === 0 && (
        <div className="h-full w-full flex flex-col items-center justify-center bg-black text-white gap-4">
          <p>No videos yet. Be the first to upload!</p>
          <button 
            onClick={seedSampleVideos}
            className="px-4 py-2 bg-indigo-600 rounded-lg hover:bg-indigo-500 transition-colors"
          >
            Add Sample Videos
          </button>
        </div>
      )}
    </div>
  );
}
