import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { Home, PlusSquare, User, Wallet, Search as SearchIcon } from 'lucide-react';
import clsx from 'clsx';
import Search from './Search';

export default function Layout() {
  const location = useLocation();

  return (
    <div className="bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white h-screen w-full flex flex-col text-sm">
      {/* Top Bar with Search - Only on Home */}
      {location.pathname === '/' && (
        <div className="absolute top-0 left-0 right-0 z-20 p-4 bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
          <div className="pointer-events-auto">
            <Search />
          </div>
        </div>
      )}

      <main className="flex-1 overflow-hidden relative">
        <Outlet />
      </main>
      
      <nav className="h-14 border-t border-white/10 bg-black/90 backdrop-blur-md flex justify-around items-center z-50 shrink-0">
        <Link to="/" className={clsx("p-2 flex flex-col items-center gap-0.5 transition-colors", location.pathname === '/' ? "text-indigo-400" : "text-gray-500 hover:text-gray-300")}>
          <Home size={20} />
          <span className="text-[10px]">Home</span>
        </Link>
        <Link to="/search" className={clsx("p-2 flex flex-col items-center gap-0.5 transition-colors", location.pathname === '/search' ? "text-indigo-400" : "text-gray-500 hover:text-gray-300")}>
          <SearchIcon size={20} />
          <span className="text-[10px]">Search</span>
        </Link>
        <Link to="/earnings" className={clsx("p-2 flex flex-col items-center gap-0.5 transition-colors", location.pathname === '/earnings' ? "text-yellow-400" : "text-gray-500 hover:text-gray-300")}>
          <Wallet size={20} />
          <span className="text-[10px]">Earn</span>
        </Link>
        <Link to="/upload" className={clsx("p-2 flex flex-col items-center gap-0.5 transition-colors", location.pathname === '/upload' ? "text-pink-500" : "text-gray-500 hover:text-gray-300")}>
          <PlusSquare size={20} />
          <span className="text-[10px]">Post</span>
        </Link>
        <Link to="/profile/me" className={clsx("p-2 flex flex-col items-center gap-0.5 transition-colors", location.pathname.startsWith('/profile') ? "text-cyan-400" : "text-gray-500 hover:text-gray-300")}>
          <User size={20} />
          <span className="text-[10px]">Profile</span>
        </Link>
      </nav>
    </div>
  );
}
