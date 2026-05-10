"use client";
import React from 'react';

interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '' }) => (
  <div className={`skeleton rounded ${className}`} />
);

export const SkeletonText: React.FC<{ lines?: number }> = ({ lines = 3 }) => (
  <div className="space-y-2">
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton
        key={i}
        className={`h-4 ${i === lines - 1 ? 'w-3/4' : 'w-full'}`}
      />
    ))}
  </div>
);

export const SkeletonAvatar: React.FC<{ size?: 'sm' | 'md' | 'lg' }> = ({ size = 'md' }) => {
  const sizes = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };
  return <Skeleton className={`${sizes[size]} rounded-full`} />;
};

export const SkeletonMessage: React.FC<{ isOwn?: boolean }> = ({ isOwn = false }) => (
  <div className={`flex items-start gap-3 ${isOwn ? 'justify-end' : 'justify-start'} animate-fade-in`}>
    {!isOwn && <SkeletonAvatar />}
    <div className="max-w-[70%] space-y-2">
      <div className="flex items-center gap-2">
        <Skeleton className="w-20 h-4" />
        <Skeleton className="w-12 h-3" />
      </div>
      <Skeleton className="w-full h-16 rounded-lg" />
    </div>
    {isOwn && <SkeletonAvatar />}
  </div>
);

export const SkeletonChannel: React.FC = () => (
  <div className="px-4 py-2 rounded-lg">
    <Skeleton className="w-full h-6" />
  </div>
);

export const SkeletonMember: React.FC = () => (
  <div className="px-4 py-2 rounded-lg flex items-center gap-3">
    <SkeletonAvatar />
    <div className="flex-1 space-y-1">
      <Skeleton className="w-24 h-4" />
      <Skeleton className="w-16 h-3" />
    </div>
  </div>
);

export const SkeletonMessageList: React.FC<{ count?: number }> = ({ count = 5 }) => (
  <div className="space-y-4 p-4">
    {Array.from({ length: count }).map((_, i) => (
      <SkeletonMessage key={i} isOwn={i % 2 === 0} />
    ))}
  </div>
);

export const SkeletonChannelList: React.FC = () => (
  <div className="space-y-4 p-4">
    <div className="space-y-1">
      <Skeleton className="w-24 h-4 mb-2" />
      {Array.from({ length: 3 }).map((_, i) => (
        <SkeletonChannel key={i} />
      ))}
    </div>
    <div className="space-y-1">
      <Skeleton className="w-24 h-4 mb-2" />
      {Array.from({ length: 3 }).map((_, i) => (
        <SkeletonChannel key={i} />
      ))}
    </div>
  </div>
);

export const SkeletonMemberList: React.FC<{ count?: number }> = ({ count = 8 }) => (
  <div className="space-y-1 p-2">
    {Array.from({ length: count }).map((_, i) => (
      <SkeletonMember key={i} />
    ))}
  </div>
);

export default Skeleton;