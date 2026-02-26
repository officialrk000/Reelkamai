import React from 'react';

export default function VideoSkeleton() {
  return (
    <div className="h-full w-full bg-gray-900 animate-pulse relative snap-start">
      {/* Sidebar Actions Skeleton */}
      <div className="absolute right-4 bottom-24 flex flex-col items-center gap-6 z-30">
        <div className="w-12 h-12 bg-gray-800 rounded-full" />
        <div className="w-12 h-12 bg-gray-800 rounded-full" />
        <div className="w-12 h-12 bg-gray-800 rounded-full" />
      </div>

      {/* Bottom Info Skeleton */}
      <div className="absolute bottom-0 left-0 right-0 z-20 p-4 pb-6 pt-24">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-gray-800" />
          <div className="h-6 w-32 bg-gray-800 rounded" />
        </div>
        <div className="h-4 w-3/4 bg-gray-800 rounded mb-2" />
        <div className="h-4 w-1/2 bg-gray-800 rounded" />
      </div>
    </div>
  );
}
