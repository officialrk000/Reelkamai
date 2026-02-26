import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Settings, Grid, Bookmark, Camera, Upload, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import EditProfileModal from '../components/EditProfileModal';
import VideoPlayer from '../components/VideoPlayer';
import { collection, query, where, getDocs, doc, getDoc, setDoc, deleteDoc, getCountFromServer, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';

interface UserProfile {
  id: string;
  username: string;
  avatar?: string;
  bio?: string;
  coins?: number;
}

interface Video {
  id: string;
  url: string;
  description: string;
  username: string;
  userId?: string; // Optional userId
  like_count: number;
  liked_by_user?: boolean;
  avatar?: string;
}

export default function Profile() {
  const { username } = useParams<{ username: string }>();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);

  const [isFollowing, setIsFollowing] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [stats, setStats] = useState({ followers: 0, following: 0 });

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const targetUsername = username === 'me' ? user?.username : username;
        if (!targetUsername) return;

        // Find user by username
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('username', '==', targetUsername));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
          // If looking for 'me' and not found in DB, use auth context
          if (username === 'me' && user) {
            setProfile({
              id: user.id,
              username: user.username,
              avatar: user.avatar,
              bio: '',
              coins: user.coins || 0
            });
            setLoading(false);
            return;
          }
          
          setProfile(null);
          setLoading(false);
          return;
        }

        const userDoc = querySnapshot.docs[0];
        const userData = userDoc.data();
        const userId = userDoc.id;

        setProfile({ id: userId, ...userData } as UserProfile);

        // Fetch videos
        const videosRef = collection(db, 'videos');
        const videosQuery = query(videosRef, where('userId', '==', userId));
        const videosSnapshot = await getDocs(videosQuery);
        const userVideos = videosSnapshot.docs.map(doc => ({
          id: doc.id,
          url: doc.data().url,
          description: doc.data().description,
          username: doc.data().username,
          userId: doc.data().userId, // Map userId
          like_count: doc.data().likeCount || 0,
          avatar: doc.data().avatar,
          liked_by_user: doc.data().likes?.includes(user?.id)
        }));
        setVideos(userVideos);

        // Check if following
        if (user && user.id !== userId) {
          const followDoc = await getDoc(doc(db, 'users', user.id, 'following', userId));
          setIsFollowing(followDoc.exists());
        }

        // Get stats
        const followersSnapshot = await getCountFromServer(collection(db, 'users', userId, 'followers'));
        const followingSnapshot = await getCountFromServer(collection(db, 'users', userId, 'following'));
        
        setStats({
          followers: followersSnapshot.data().count,
          following: followingSnapshot.data().count
        });

      } catch (err) {
        console.error(err);
        // Fallback for current user if Firestore fails
        if (username === 'me' && user) {
          setProfile({
            id: user.id,
            username: user.username,
            avatar: user.avatar,
            bio: '',
            coins: user.coins || 0
          });
        }
      } finally {
        setLoading(false);
      }
    };

    if (user || username !== 'me') {
      fetchProfile();
    }
  }, [username, user]);

  const handleFollow = async () => {
    if (!user || !profile) return;
    
    try {
      if (isFollowing) {
        // Unfollow
        await deleteDoc(doc(db, 'users', user.id, 'following', profile.id));
        await deleteDoc(doc(db, 'users', profile.id, 'followers', user.id));
        setIsFollowing(false);
        setStats(prev => ({ ...prev, followers: prev.followers - 1 }));
      } else {
        // Follow
        await setDoc(doc(db, 'users', user.id, 'following', profile.id), {
          timestamp: new Date()
        });
        await setDoc(doc(db, 'users', profile.id, 'followers', user.id), {
          timestamp: new Date()
        });
        setIsFollowing(true);
        setStats(prev => ({ ...prev, followers: prev.followers + 1 }));
      }
    } catch (err) {
      console.error('Failed to toggle follow', err);
    }
  };

  const handleProfileUpdate = (updatedUser: any) => {
    setProfile(updatedUser);
    // Auth context updates automatically via snapshot listener
  };

  const handleAvatarClick = () => {
    if (isOwnProfile && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0] && user) {
      const file = e.target.files[0];
      setUploadingAvatar(true);
      try {
        const storageRef = ref(storage, `avatars/${user.id}/${file.name}`);
        const snapshot = await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(snapshot.ref);

        // Update Firestore - Use setDoc with merge to handle missing documents
        await setDoc(doc(db, 'users', user.id), {
          avatar: downloadURL,
          username: user.username, // Ensure username is saved if creating new doc
          email: user.email        // Ensure email is saved if creating new doc
        }, { merge: true });

        // Update local state
        setProfile(prev => prev ? { ...prev, avatar: downloadURL } : null);
      } catch (err) {
        console.error("Failed to upload avatar", err);
        alert("Failed to upload profile picture");
      } finally {
        setUploadingAvatar(false);
      }
    }
  };

  if (loading) {
    return <div className="h-full flex items-center justify-center bg-black text-white">Loading...</div>;
  }

  if (!profile) {
    return <div className="h-full flex items-center justify-center bg-black text-white">User not found</div>;
  }

  const isOwnProfile = user?.username === profile.username || (username === 'me');

  return (
    <div className="h-full bg-gradient-to-b from-gray-900 to-black text-white overflow-y-auto pb-20 no-scrollbar relative">
      {/* Profile Info */}
      <div className="p-6 flex flex-col items-center gap-4 pt-10">
        <div 
          className={`w-24 h-24 rounded-full bg-gray-800 border-2 border-cyan-500 overflow-hidden shadow-lg shadow-cyan-500/20 relative ${isOwnProfile ? 'cursor-pointer group' : ''}`}
          onClick={handleAvatarClick}
        >
          {profile.avatar ? (
            <img src={profile.avatar} alt={profile.username} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-gray-500">
              {profile.username[0].toUpperCase()}
            </div>
          )}
          
          {isOwnProfile && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              {uploadingAvatar ? (
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
              ) : (
                <Camera size={24} className="text-white" />
              )}
            </div>
          )}
        </div>
        
        {isOwnProfile && (
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept="image/*" 
            className="hidden" 
          />
        )}
        
        <div className="text-center">
          <h2 className="font-bold text-xl text-white">
            @{profile.username.includes('@') ? profile.username.split('@')[0] : profile.username}
          </h2>
          <p className="text-gray-400 text-sm mt-1 whitespace-pre-wrap">{profile.bio || 'No bio yet.'}</p>
          
          {/* Coins Display - Only visible to owner */}
          {isOwnProfile && (
            <div className="mt-2 inline-flex items-center gap-1 bg-yellow-500/10 border border-yellow-500/30 px-3 py-1 rounded-full">
              <span className="text-yellow-400 text-xs font-bold">🪙 {profile.coins || 0} Coins</span>
            </div>
          )}
        </div>

        <div className="flex gap-8 text-center">
          <div>
            <span className="block font-bold text-lg text-white">{videos.length}</span>
            <span className="text-xs text-gray-500">Posts</span>
          </div>
          <div>
            <span className="block font-bold text-lg text-white">{stats.followers}</span>
            <span className="text-xs text-gray-500">Followers</span>
          </div>
          <div>
            <span className="block font-bold text-lg text-white">{stats.following}</span>
            <span className="text-xs text-gray-500">Following</span>
          </div>
        </div>

        {isOwnProfile ? (
          <div className="w-full space-y-2">
            <button 
              onClick={() => setIsEditing(true)}
              className="w-full py-2 bg-gray-800/80 border border-white/10 rounded-lg font-medium text-sm hover:bg-gray-700 transition-colors"
            >
              Edit Profile
            </button>
            <button 
              onClick={() => {
                logout();
                navigate('/login');
              }}
              className="w-full py-2 bg-red-900/20 border border-red-500/20 text-red-400 rounded-lg font-medium text-sm hover:bg-red-900/40 transition-colors"
            >
              Logout
            </button>
          </div>
        ) : (
          <button 
            onClick={handleFollow}
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
            className={`w-full py-2 rounded-lg font-medium text-sm transition-colors shadow-lg ${
              isFollowing 
                ? 'bg-gray-700 hover:bg-red-600/20 hover:text-red-400 hover:border-red-500/50 border border-transparent text-white' 
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/20'
            }`}
          >
            {isFollowing ? (isHovering ? 'Unfollow' : 'Following') : 'Follow'}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-t border-white/10 mt-2">
        <button className="flex-1 py-3 flex justify-center border-b-2 border-cyan-500 text-cyan-400 bg-white/5">
          <Grid size={20} />
        </button>
        <button className="flex-1 py-3 flex justify-center text-gray-500 hover:text-gray-300 transition-colors">
          <Bookmark size={20} />
        </button>
      </div>

      {/* Video Grid */}
      <div className="grid grid-cols-3 gap-0.5 mt-0.5">
        {videos.map((video) => (
          <div 
            key={video.id} 
            className="aspect-[3/4] bg-gray-900 relative cursor-pointer"
            onClick={() => setSelectedVideo(video)}
          >
            <video 
              src={video.url} 
              className="w-full h-full object-cover" 
              muted 
            />
            <div className="absolute inset-0 bg-black/10 hover:bg-black/0 transition-colors" />
          </div>
        ))}
      </div>

      {isEditing && (
        <EditProfileModal 
          currentBio={profile.bio} 
          onClose={() => setIsEditing(false)} 
          onUpdate={handleProfileUpdate}
        />
      )}

      {/* Full Screen Video Modal */}
      {selectedVideo && (
        <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
          <button 
            onClick={() => setSelectedVideo(null)}
            className="absolute top-4 right-4 z-50 p-2 bg-black/50 rounded-full text-white"
          >
            <X size={24} />
          </button>
          <div className="w-full h-full max-w-md mx-auto relative">
            <VideoPlayer 
              video={selectedVideo} 
              isActive={true} 
              preload="auto" 
            />
          </div>
        </div>
      )}
    </div>
  );
}
