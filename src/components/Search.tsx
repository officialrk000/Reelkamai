import React, { useState, useEffect, useRef } from 'react';
import { Search as SearchIcon, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { collection, query, where, getDocs, limit, orderBy, startAt, endAt } from 'firebase/firestore';
import { db } from '../firebase';

interface SearchResult {
  id: string;
  username: string;
  avatar?: string;
}

export default function Search() {
  const [queryText, setQueryText] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const searchUsers = async () => {
      if (queryText.length < 2) {
        setResults([]);
        return;
      }

      try {
        // Firestore doesn't support simple substring search. 
        // We use startAt/endAt for prefix search which is standard for usernames.
        const q = query(
          collection(db, 'users'),
          orderBy('username'),
          startAt(queryText),
          endAt(queryText + '\uf8ff'),
          limit(5)
        );

        const snapshot = await getDocs(q);
        const users = snapshot.docs.map(doc => ({
          id: doc.id,
          username: doc.data().username,
          avatar: doc.data().avatar
        }));
        setResults(users);
      } catch (err) {
        console.error(err);
      }
    };

    const timeoutId = setTimeout(searchUsers, 300);
    return () => clearTimeout(timeoutId);
  }, [queryText]);

  return (
    <div ref={searchRef} className="relative w-full max-w-xs mx-auto">
      <div className="relative">
        <input
          type="text"
          placeholder="Search users..."
          value={queryText}
          onChange={(e) => {
            setQueryText(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          className="w-full bg-gray-900 text-white pl-10 pr-4 py-2 rounded-full text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 border border-white/10"
        />
        <SearchIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        {queryText && (
          <button 
            onClick={() => {
              setQueryText('');
              setResults([]);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {isOpen && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-gray-900/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden z-[100] max-h-60 overflow-y-auto no-scrollbar">
          {results.map((user) => (
            <Link
              key={user.id}
              to={`/profile/${user.username}`}
              onClick={() => {
                setIsOpen(false);
                setQueryText('');
              }}
              className="flex items-center gap-3 p-3 hover:bg-white/10 transition-colors border-b border-white/5 last:border-0 cursor-pointer"
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 p-[2px]">
                <div className="w-full h-full rounded-full bg-gray-900 overflow-hidden flex items-center justify-center">
                  {user.avatar ? (
                    <img src={user.avatar} alt={user.username} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs font-bold text-white">
                      {user.username[0].toUpperCase()}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-col">
                <span className="text-white text-sm font-semibold">{user.username}</span>
                <span className="text-gray-400 text-xs">View Profile</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
