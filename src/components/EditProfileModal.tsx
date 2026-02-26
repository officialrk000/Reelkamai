import React, { useState } from 'react';
import { X, Upload } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { v4 as uuidv4 } from 'uuid';

interface EditProfileModalProps {
  currentBio?: string;
  onClose: () => void;
  onUpdate: (user: any) => void;
}

export default function EditProfileModal({ currentBio, onClose, onUpdate }: EditProfileModalProps) {
  const [bio, setBio] = useState(currentBio || '');
  const [avatar, setAvatar] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    try {
      let avatarUrl = user.avatar;

      if (avatar) {
        const storageRef = ref(storage, `avatars/${user.id}/${uuidv4()}_${avatar.name}`);
        const snapshot = await uploadBytes(storageRef, avatar);
        avatarUrl = await getDownloadURL(snapshot.ref);
      }

      const userRef = doc(db, 'users', user.id);
      await updateDoc(userRef, {
        bio: bio,
        avatar: avatarUrl
      });

      onUpdate({ ...user, bio, avatar: avatarUrl });
      onClose();
    } catch (err: any) {
      console.error("Profile update error:", err);
      if (err.code === 'storage/unauthorized' || err.code === 'storage/unauthenticated') {
        alert("⚠️ STORAGE PERMISSION ERROR\n\nYou must update your Firebase Storage Rules to allow uploads.\n\nGo to Firebase Console > Storage > Rules and change them to:\n\nallow read, write: if true;");
      } else {
        alert('Error updating profile: ' + (err.message || 'Unknown error'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-gray-900 w-full max-w-md rounded-2xl p-6 border border-white/10">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white">Edit Profile</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex flex-col items-center gap-4">
            <div className="w-24 h-24 rounded-full bg-gray-800 overflow-hidden border-2 border-dashed border-gray-600 relative group cursor-pointer">
              {avatar ? (
                <img src={URL.createObjectURL(avatar)} className="w-full h-full object-cover" />
              ) : user?.avatar ? (
                <img src={user.avatar} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-500">
                  <Upload size={24} />
                </div>
              )}
              <input 
                type="file" 
                accept="image/*" 
                onChange={(e) => e.target.files && setAvatar(e.target.files[0])}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                <span className="text-xs text-white font-medium">Change</span>
              </div>
            </div>
            <span className="text-sm text-gray-400">Tap to change avatar</span>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none resize-none h-24"
              placeholder="Tell us about yourself..."
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors"
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </div>
    </div>
  );
}
