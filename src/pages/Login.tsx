import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import { Loader2 } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/welcome');
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError('Invalid email or password. Please try again.');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Too many failed attempts. Please try again later.');
      } else {
        setError(err.message || 'Login failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen bg-gradient-to-br from-black via-gray-900 to-indigo-950 text-white flex flex-col items-center justify-center p-6">
      <h1 className="text-2xl font-black mb-6 bg-gradient-to-r from-indigo-400 to-purple-500 bg-clip-text text-transparent tracking-tighter">
        ReelKamai
      </h1>
      
      <form onSubmit={handleSubmit} className="w-full max-w-xs space-y-4 bg-black/40 p-6 rounded-2xl border border-white/10 backdrop-blur-xl shadow-2xl">
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1 uppercase tracking-wider">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-gray-900/50 border border-gray-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
            required
            disabled={loading}
          />
        </div>
        
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1 uppercase tracking-wider">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-gray-900/50 border border-gray-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
            required
            disabled={loading}
          />
        </div>

        {error && <p className="text-red-400 text-sm bg-red-500/10 p-2 rounded border border-red-500/20">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-indigo-500/25 mt-2 flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {loading ? <Loader2 className="animate-spin" /> : 'Log In'}
        </button>
      </form>

      <p className="mt-8 text-gray-400 text-sm">
        Don't have an account?{' '}
        <Link to="/signup" className="text-indigo-400 hover:text-indigo-300 font-semibold transition-colors">
          Sign up
        </Link>
      </p>
    </div>
  );
}
