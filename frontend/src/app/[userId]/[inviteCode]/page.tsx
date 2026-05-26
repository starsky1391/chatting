"use client";

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState } from 'react';
import { useRouter, useParams, usePathname } from 'next/navigation';
import { useChatStore } from '@/store/useChatStore';
import { config } from '@/lib/config';

const MainLayout = dynamic(() => import('../../../components/MainLayout'), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-screen bg-gray-900 text-white">Loading…</div>,
});

interface GroupPreview {
  id: number;
  name: string;
  description: string;
  icon: string;
  ownerId: number;
  inviteCode: string;
  inviteLink: string;
  memberCount: number;
  isMember: boolean;
}

export default function GroupPage() {
  const router = useRouter();
  const params = useParams();
  const pathname = usePathname();
  const [isLoading, setIsLoading] = useState(true);
  const [groupPreview, setGroupPreview] = useState<GroupPreview | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setCurrentGroupId = useChatStore((state) => state.setCurrentGroupId);
  const setCurrentChannel = useChatStore((state) => state.setCurrentChannel);

  const fetchGroupPreview = useCallback(async (inviteCode: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${config.api.baseUrl}/api/invite/${encodeURIComponent(inviteCode)}/preview`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        setError('邀请码无效或群组不存在');
        setIsLoading(false);
        return;
      }

      const data = await response.json();
      const group = data.data as GroupPreview;
      setGroupPreview(group);

      // If already a member, set as current group and show main layout
      if (group.isMember) {
        setCurrentGroupId(group.id);
        setCurrentChannel(null);
      }

      setIsLoading(false);
    } catch (err) {
      console.error('Failed to fetch group preview:', err);
      setError('加载群组信息失败');
      setIsLoading(false);
    }
  }, [setCurrentChannel, setCurrentGroupId]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');

    if (!token) {
      // Redirect to login with current URL as redirect param
      router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
      return;
    }

    // Verify the userId in URL matches the logged-in user
    if (user) {
      try {
        const userData = JSON.parse(user);
        const urlUserId = params.userId;
        if (urlUserId && String(userData.id) !== String(urlUserId)) {
          // Redirect to correct user URL with the same invite code
          router.replace(`/${userData.id}/${params.inviteCode}`);
          return;
        }
      } catch {
        // Ignore parse errors
      }
    }

    // Look up the group by invite code
    const inviteCodeParam = params.inviteCode as string;
    if (inviteCodeParam) {
      // Convert URL-safe format back: replace _ with # for API lookup
      // e.g. "ABCD1234EFGH_1" -> "ABCD1234EFGH#1"
      const inviteCode = inviteCodeParam.replace(/_(\d+)$/, '#$1');
      queueMicrotask(() => {
        void fetchGroupPreview(inviteCode);
      });
    }
  }, [fetchGroupPreview, router, params.userId, params.inviteCode, pathname]);

  const handleJoinGroup = async () => {
    if (!groupPreview || isJoining) return;
    
    setIsJoining(true);
    try {
      const token = localStorage.getItem('token');
      const inviteCodeParam = params.inviteCode as string;
      const inviteCode = inviteCodeParam.replace(/_(\d+)$/, '#$1');
      
      const response = await fetch(`${config.api.baseUrl}/api/groups/join/${encodeURIComponent(inviteCode)}`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to join group');
      }

      // Success - set as current group
      setCurrentGroupId(groupPreview.id);
      setCurrentChannel(null);
      
      // Update the preview to show we're now a member
      setGroupPreview(prev => prev ? { ...prev, isMember: true } : null);
    } catch (err) {
      console.error('Failed to join group:', err);
      setError('加入群组失败，请重试');
    } finally {
      setIsJoining(false);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto mb-4"></div>
          <p>加载中…</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !groupPreview) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">😕</div>
          <h2 className="text-xl font-bold mb-2">出错了</h2>
          <p className="text-gray-400 mb-6">{error}</p>
          <button
            onClick={() => {
              const user = localStorage.getItem('user');
              if (user) {
                try {
                  const userData = JSON.parse(user);
                  router.push(`/${userData.id}`);
                  return;
                } catch {}
              }
              router.push('/');
            }}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
          >
            返回主页
          </button>
        </div>
      </div>
    );
  }

  // Not a member - show join preview
  if (groupPreview && !groupPreview.isMember) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white p-4">
        <div className="bg-gray-800 rounded-2xl shadow-xl max-w-md w-full p-8 text-center">
          {/* Group Icon */}
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-indigo-600 flex items-center justify-center text-3xl">
            {groupPreview.icon || '💬'}
          </div>
          
          {/* Group Name */}
          <h1 className="text-2xl font-bold mb-2">{groupPreview.name}</h1>
          
          {/* Description */}
          {groupPreview.description && (
            <p className="text-gray-400 mb-4">{groupPreview.description}</p>
          )}
          
          {/* Member Count */}
          <div className="flex items-center justify-center gap-2 text-gray-500 mb-6">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <span>{groupPreview.memberCount} 位成员</span>
          </div>
          
          {/* Join Button */}
          <button
            onClick={handleJoinGroup}
            disabled={isJoining}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-800 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
          >
            {isJoining ? (
              <span className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                加入中…
              </span>
            ) : (
              '加入群组'
            )}
          </button>
          
          {/* Error message */}
          {error && (
            <p className="mt-4 text-red-400 text-sm">{error}</p>
          )}
          
          {/* Cancel link */}
          <button
            onClick={() => {
              const user = localStorage.getItem('user');
              if (user) {
                try {
                  const userData = JSON.parse(user);
                  router.push(`/${userData.id}`);
                  return;
                } catch {}
              }
              router.push('/');
            }}
            className="mt-4 text-gray-500 hover:text-gray-300 text-sm transition-colors"
          >
            取消
          </button>
        </div>
      </div>
    );
  }

  // Is a member - show main layout
  return <MainLayout />;
}
