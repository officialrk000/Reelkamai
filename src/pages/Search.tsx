import React, { useState, useEffect } from 'react';
import { Search as SearchIcon, X, User } from 'lucide-react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { Link } from 'react-router-dom';

interface UserResult {
  id: string;
  username: string;
  avatar?: string;
  bio?: string;
}

export default function Search() {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<UserResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const searchUsers = async () => {
      if (searchTerm.trim().length < 2) {
        setResults([]);
        return;
      }

      setLoading(true);
      try {
        const usersRef = collection(db, 'users');
        
        // Try exact match first if prefix search fails or returns nothing
        // Note: Firestore is case-sensitive. "John" != "john".
        // A robust solution requires storing a lowercase username field.
        // For now, we will try to query as-is.
        
        const q = query(
          usersRef, 
          where('username', '>=', searchTerm),
          where('username', '<=', searchTerm + '\uf8ff')
        );
        
        const snapshot = await getDocs(q);
        const users = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as UserResult[];

        // If no results, try capitalizing the first letter as a fallback heuristic
        if (users.length === 0 && searchTerm.length > 0) {
           const capitalized = searchTerm.charAt(0).toUpperCase() + searchTerm.slice(1);
           if (capitalized !== searchTerm) {
             const q2 = query(
                usersRef, 
                where('username', '>=', capitalized),
                where('username', '<=', capitalized + '\uf8ff')
             );
             const snapshot2 = await getDocs(q2);
             const users2 = snapshot2.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
             })) as UserResult[];
             setResults(users2);
             return;
           }
        }

        setResults(users);
      } catch (error) {
        console.error("Search error:", error);
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(searchUsers, 500);
    return () => clearTimeout(debounce);
  }, [searchTerm]);

  return (
    <div className="h-full bg-black text-white p-4 flex flex-col">
      <div className="relative mb-6">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
        <input
          type="text"
          placeholder="Search users..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-gray-900 border border-gray-800 rounded-full py-3 pl-10 pr-4 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
        />
        {searchTerm && (
          <button 
            onClick={() => setSearchTerm('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
          >
            <X size={16} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center p-4 text-gray-500">Searching...</div>
        ) : results.length > 0 ? (
          <div className="space-y-4">
            {results.map(user => (
              <Link key={user.id} to={`/profile/${user.username}`} className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-xl hover:bg-gray-800 transition-colors">
                <div className="w-12 h-12 rounded-full bg-gray-700 overflow-hidden border border-gray-600">
                  {user.avatar ? (
                    <img src={user.avatar} alt={user.username} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-lg font-bold text-gray-400">
                      {user.username[0].toUpperCase()}
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-white">@{user.username}</h3>
                  {user.bio && <p className="text-xs text-gray-400 line-clamp-1">{user.bio}</p>}
                </div>
              </Link>
            ))}
          </div>
        ) : searchTerm.length >= 2 ? (
          <div className="text-center text-gray-500 mt-10">No users found</div>
        ) : (
          <div className="flex flex-col items-center justify-center h-64 text-gray-600 gap-2">
            <User size={48} className="opacity-20" />
            <p>Type to search users</p>
          </div>
        )}
      </div>
    </div>
  );
}
