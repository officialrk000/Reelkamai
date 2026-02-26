import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload as UploadIcon, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, serverTimestamp, doc, updateDoc, increment, setDoc } from 'firebase/firestore';
import { storage, db } from '../firebase';
import { v4 as uuidv4 } from 'uuid';

export default function Upload() {
  const [file, setFile] = useState<File | null>(null);
  const [description, setDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !user) return;

    setUploading(true);

    try {
      // Upload to Firebase Storage
      const storageRef = ref(storage, `videos/${user.id}/${uuidv4()}_${file.name}`);
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);

      // Save metadata to Firestore
      await addDoc(collection(db, 'videos'), {
        userId: user.id,
        username: user.username,
        avatar: user.avatar || '',
        url: downloadURL,
        description: description,
        likeCount: 0,
        createdAt: serverTimestamp(),
        likes: [] // Array of user IDs who liked
      });

      // Award coins for uploading
      const userRef = doc(db, 'users', user.id);
      await setDoc(userRef, {
        coins: increment(10) // Award 10 coins per upload
      }, { merge: true });

      // Add to earnings history
      await addDoc(collection(db, 'users', user.id, 'earnings'), {
        amount: 10,
        type: 'upload',
        createdAt: serverTimestamp()
      });

      // Redirect to profile to see the new video and coins
      navigate('/profile/me');
    } catch (err: any) {
      console.error("Upload error:", err);
      if (err.code === 'storage/unauthorized' || err.code === 'storage/unauthenticated') {
        alert("⚠️ STORAGE PERMISSION ERROR\n\nYou must update your Firebase Storage Rules to allow uploads.\n\nGo to Firebase Console > Storage > Rules and change them to:\n\nallow read, write: if true;");
      } else {
        alert('Error uploading video: ' + (err.message || 'Unknown error'));
      }
    } finally {
      setUploading(false);
    }
  };

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-black text-white p-4">
        <p className="mb-4">You must be logged in to upload.</p>
        <button 
          onClick={() => navigate('/login')}
          className="bg-indigo-600 px-6 py-2 rounded-full font-semibold"
        >
          Go to Login
        </button>
      </div>
    );
  }

  return (
    <div className="h-full bg-black text-white p-4 flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-bold">New Post</h1>
        <button onClick={() => navigate(-1)}>
          <X size={24} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 flex flex-col gap-6">
        <div className="flex-1 border-2 border-dashed border-gray-700 rounded-xl flex flex-col items-center justify-center relative overflow-hidden bg-gray-900">
          {file ? (
            <video 
              src={URL.createObjectURL(file)} 
              className="absolute inset-0 w-full h-full object-cover" 
              autoPlay
              muted
              loop
              playsInline
              controls={false}
            />
          ) : (
            <label className="flex flex-col items-center cursor-pointer p-8 text-center">
              <UploadIcon size={48} className="text-gray-500 mb-2" />
              <span className="text-gray-400 font-medium">Tap to select video</span>
              <span className="text-xs text-gray-600 mt-1">MP4, WebM up to 50MB</span>
              <input 
                type="file" 
                accept="video/mp4,video/webm" 
                onChange={handleFileChange} 
                className="hidden" 
              />
            </label>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-300">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add a caption..."
            className="w-full bg-gray-900 border border-gray-800 rounded-lg p-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none resize-none h-24"
          />
        </div>

        <button
          type="submit"
          disabled={!file || uploading}
          className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-colors"
        >
          {uploading ? 'Uploading...' : 'Post Video'}
        </button>
      </form>
    </div>
  );
}
