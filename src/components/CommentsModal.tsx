import React, { useState, useEffect } from 'react';
import { X, Send } from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

interface Comment {
  id: string;
  text: string;
  username: string;
  avatar?: string;
  created_at: string;
}

interface CommentsModalProps {
  videoId: string;
  onClose: () => void;
}

export default function CommentsModal({ videoId, onClose }: CommentsModalProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    const q = query(
      collection(db, 'videos', videoId, 'comments'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newComments = snapshot.docs.map(doc => ({
        id: doc.id,
        text: doc.data().text,
        username: doc.data().username,
        avatar: doc.data().avatar,
        created_at: doc.data().createdAt?.toDate().toISOString() || new Date().toISOString()
      }));
      setComments(newComments);
      setLoading(false);
    }, (error) => {
      console.error("Comments snapshot error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [videoId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !user) return;

    try {
      await addDoc(collection(db, 'videos', videoId, 'comments'), {
        text: newComment,
        userId: user.id,
        username: user.username,
        avatar: user.avatar || '',
        createdAt: serverTimestamp()
      });
      setNewComment('');
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <motion.div 
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="fixed inset-x-0 bottom-0 h-[70vh] bg-gray-900 rounded-t-3xl z-50 flex flex-col border-t border-white/10 shadow-2xl"
    >
      <div className="flex justify-between items-center p-4 border-b border-white/10">
        <h3 className="font-bold text-white text-center flex-1">Comments</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-white absolute right-4">
          <X size={24} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <div className="text-center text-gray-500 py-4">Loading comments...</div>
        ) : comments.length === 0 ? (
          <div className="text-center text-gray-500 py-8">No comments yet. Say something!</div>
        ) : (
          comments.map((comment) => (
            <div key={comment.id} className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-gray-700 overflow-hidden flex-shrink-0">
                {comment.avatar ? (
                  <img src={comment.avatar} alt={comment.username} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs font-bold text-gray-400">
                    {comment.username[0].toUpperCase()}
                  </div>
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-semibold text-gray-300">{comment.username}</span>
                  <span className="text-xs text-gray-500">{new Date(comment.created_at).toLocaleDateString()}</span>
                </div>
                <p className="text-sm text-white mt-0.5">{comment.text}</p>
              </div>
            </div>
          ))
        )}
      </div>

      <form onSubmit={handleSubmit} className="p-4 border-t border-white/10 bg-gray-900 pb-8">
        <div className="relative flex items-center">
          <input
            type="text"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder={user ? "Add a comment..." : "Log in to comment"}
            disabled={!user}
            className="w-full bg-gray-800 text-white rounded-full pl-4 pr-12 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <button 
            type="submit" 
            disabled={!newComment.trim() || !user}
            className="absolute right-2 p-2 text-indigo-500 disabled:opacity-50 hover:text-indigo-400"
          >
            <Send size={20} />
          </button>
        </div>
      </form>
    </motion.div>
  );
}
