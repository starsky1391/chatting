"use client";
/* eslint-disable @next/next/no-img-element */
import React, { useState, useEffect, useCallback } from 'react';
import { useChatStore } from '../../store/useChatStore';
import { usePathname, useRouter } from 'next/navigation';
import { config } from '@/lib/config';
import ContextMenu from '../ui/ContextMenu';
import ConfirmModal from '../ui/ConfirmModal';

interface ServerListProps {
  isLoading?: boolean;
}

type Group = {
  id: number;
  name: string;
  icon?: string;
  ownerId?: number;
  inviteCode?: string;
  inviteLink?: string;
};

const ServerList: React.FC<ServerListProps> = ({ isLoading = false }) => {
  const currentUser = useChatStore((state) => state.currentUser);
  const currentGroupId = useChatStore((state) => state.currentGroupId);
  const setCurrentGroupId = useChatStore((state) => state.setCurrentGroupId);
  const setCurrentChannel = useChatStore((state) => state.setCurrentChannel);
  const logout = useChatStore((state) => state.logout);
  const router = useRouter();
  const pathname = usePathname();

  const [groups, setGroups] = useState<Group[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'create' | 'join'>('create');
  const [newGroupName, setNewGroupName] = useState('');
  const [joinInviteCode, setJoinInviteCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; name: string } | null>(null);
  const [hoveredTooltip, setHoveredTooltip] = useState<string | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);

  const showTooltip = (key: string, event: React.MouseEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setHoveredTooltip(key);
    setTooltipPosition({
      x: rect.right + 12,
      y: rect.top + rect.height / 2,
    });
  };

  const hideTooltip = () => {
    setHoveredTooltip(null);
    setTooltipPosition(null);
  };

  const fetchGroups = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${config.api.baseUrl}/api/groups`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setGroups(Array.isArray(data.data) ? data.data : []);
      }
    } catch (error) {
      console.error('Failed to fetch groups:', error);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void fetchGroups();
    });
  }, [fetchGroups]);

  useEffect(() => {
    const refresh = () => void fetchGroups();
    window.addEventListener('groups:refresh', refresh);
    return () => window.removeEventListener('groups:refresh', refresh);
  }, [fetchGroups]);

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${config.api.baseUrl}/api/groups`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: newGroupName })
      });
      if (response.ok) {
        setNewGroupName('');
        setIsAddModalOpen(false);
        void fetchGroups();
      }
    } catch (error) {
      console.error('Failed to create group:', error);
    }
  };

  const handleDeleteGroup = async () => {
    if (!deleteConfirm) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${config.api.baseUrl}/api/groups/${deleteConfirm.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        if (currentGroupId === deleteConfirm.id) {
          setCurrentGroupId(null);
          setCurrentChannel(null);
        }
        void fetchGroups();
      }
    } catch (error) {
      console.error('Failed to delete group:', error);
    }
    setDeleteConfirm(null);
  };

  const handleJoinGroup = async () => {
    if (!joinInviteCode.trim()) return;
    setJoinError('');
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${config.api.baseUrl}/api/groups/join/${encodeURIComponent(joinInviteCode.trim())}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        setJoinInviteCode('');
        setIsAddModalOpen(false);
        void fetchGroups();
      } else {
        const data = await response.json().catch(() => ({}));
        setJoinError(data.message || 'Invalid invite code');
      }
    } catch {
      setJoinError('Failed to join server');
    }
  };

  const handleGroupClick = (group: Group) => {
    if (currentGroupId === group.id) return;
    setCurrentGroupId(group.id);
    setCurrentChannel(null);
    // Navigate to group-specific URL
    // Convert inviteLink format: "CODE#OWNER_ID" -> "CODE_OWNER_ID" for URL safety
    const inviteLink = group.inviteLink || group.inviteCode;
    if (currentUser?.id && inviteLink) {
      const urlSafeCode = inviteLink.replace('#', '_');
      router.push(`/${currentUser.id}/${urlSafeCode}`);
    }
  };

  const handleLogout = async () => {
    try {
      const token = localStorage.getItem('token');
      if (token) {
        await fetch(`${config.api.baseUrl}/api/auth/logout`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        }).catch(() => {});
      }
    } catch (error) {
      console.error('Logout error:', error);
    }
    logout();
    router.push('/login');
  };

  const getInitial = (name: string) => {
    return name?.charAt(0)?.toUpperCase() || 'G';
  };

  const getGroupIconUrl = (icon?: string) => {
    if (!icon) return '';
    if (icon.startsWith('http')) return icon;
    if (icon.startsWith('/uploads/')) return `${config.api.baseUrl}${icon}`;
    return '';
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2 items-center py-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="w-12 h-12 rounded-full bg-zinc-700/50 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col items-center py-2">
      <div className="flex flex-col items-center gap-2">
        <div
          className="relative"
          onMouseEnter={(event) => showTooltip('dm', event)}
          onMouseLeave={hideTooltip}
        >
          <button
            onClick={() => {
              setCurrentGroupId(null);
              setCurrentChannel(null);
              if (currentUser?.id) router.push(`/${currentUser.id}/dm`);
            }}
            className={cn(
              "flex h-12 w-12 items-center justify-center text-lg font-bold transition-all duration-200 hover:scale-105",
              pathname.endsWith('/dm')
                ? "rounded-xl bg-indigo-500 text-white"
                : "rounded-full bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 hover:rounded-xl"
            )}
            aria-label="Direct Messages"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h8M8 14h5m8-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
          {hoveredTooltip === 'dm' && tooltipPosition && <TooltipLabel text="Direct Messages" position={tooltipPosition} />}
        </div>

        {currentUser?.role === 'admin' && (
          <div
            className="relative"
            onMouseEnter={(event) => showTooltip('admin', event)}
            onMouseLeave={hideTooltip}
          >
            <button
              onClick={() => router.push('/admin')}
              className={cn(
                "flex h-12 w-12 items-center justify-center text-lg font-bold transition-all duration-200 hover:scale-105",
                pathname === '/admin'
                  ? "rounded-xl bg-amber-500 text-white"
                  : "rounded-full bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 hover:rounded-xl"
              )}
              aria-label="Admin"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3l7 4v5c0 4.5-2.9 8.4-7 9-4.1-.6-7-4.5-7-9V7l7-4z" />
              </svg>
            </button>
            {hoveredTooltip === 'admin' && tooltipPosition && <TooltipLabel text="Admin" position={tooltipPosition} />}
          </div>
        )}

        <div className="w-8 h-0.5 rounded-full bg-zinc-700/50" />

        <div
          className="relative"
          onMouseEnter={(event) => showTooltip('add', event)}
          onMouseLeave={hideTooltip}
        >
          <button
            onClick={() => { setIsAddModalOpen(true); setActiveTab('create'); setJoinError(''); }}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-700/50 text-zinc-400 transition-all duration-200 hover:scale-105 hover:rounded-xl hover:bg-green-500/20 hover:text-green-400"
            aria-label="Add a Server"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
          {hoveredTooltip === 'add' && tooltipPosition && <TooltipLabel text="Add a Server" position={tooltipPosition} />}
        </div>
      </div>

      <div className="no-scrollbar mt-2 flex-1 min-h-0 w-full overflow-y-auto overflow-x-hidden">
        <div className="flex flex-col items-center gap-2 py-1">
          {groups.map((group) => {
            const iconUrl = getGroupIconUrl(group.icon);
            const hasImage = !!iconUrl;
            return (
              <div
                key={group.id}
                className="relative"
                onMouseEnter={(event) => showTooltip(`group-${group.id}`, event)}
                onMouseLeave={hideTooltip}
              >
                <ContextMenu
                  items={[
                    {
                      label: 'Delete Server',
                      icon: (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.846L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      ),
                      onClick: () => setDeleteConfirm({ id: group.id, name: group.name }),
                      danger: true,
                      disabled: group.ownerId !== currentUser?.id
                    }
                  ]}
                >
                  <button
                    onClick={() => handleGroupClick(group)}
                    className={cn(
                      "group flex h-12 w-12 items-center justify-center overflow-hidden text-lg font-bold transition-all duration-200 hover:scale-105",
                      currentGroupId === group.id
                        ? "rounded-[14px] bg-indigo-500 text-white shadow-lg"
                        : hasImage
                          ? "rounded-[14px] bg-zinc-700/50 text-zinc-300 hover:bg-zinc-600/50"
                          : "rounded-[14px] bg-zinc-700/50 text-zinc-300 hover:bg-zinc-600/50"
                    )}
                    aria-label={group.name}
                  >
                    {iconUrl ? (
                      <img src={iconUrl} alt={group.name} className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105" />
                    ) : group.icon ? (
                      <span className="text-2xl">{group.icon}</span>
                    ) : (
                      getInitial(group.name)
                    )}
                  </button>
                </ContextMenu>
                {hoveredTooltip === `group-${group.id}` && tooltipPosition && <TooltipLabel text={group.name} position={tooltipPosition} />}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-2 flex flex-col items-center gap-2">
        <div
          className="relative"
          onMouseEnter={(event) => showTooltip('profile', event)}
          onMouseLeave={hideTooltip}
        >
          <button
            onClick={() => router.push('/profile')}
            className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-zinc-700/50 transition-all duration-200 hover:scale-105 hover:rounded-xl"
            aria-label={currentUser?.username || 'Profile'}
          >
            {currentUser?.avatarUrl ? (
              <img src={`${config.api.baseUrl}${currentUser.avatarUrl}`} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="text-lg font-bold text-zinc-300">
                {currentUser?.username?.charAt(0)?.toUpperCase() || 'U'}
              </span>
            )}
          </button>
          {hoveredTooltip === 'profile' && tooltipPosition && <TooltipLabel text={currentUser?.username || 'Profile'} position={tooltipPosition} />}
        </div>

        <div
          className="relative"
          onMouseEnter={(event) => showTooltip('logout', event)}
          onMouseLeave={hideTooltip}
        >
          <button
            onClick={handleLogout}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-700/50 text-zinc-400 transition-all duration-200 hover:scale-105 hover:rounded-xl hover:bg-red-500/20 hover:text-red-400"
            aria-label="Logout"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
          {hoveredTooltip === 'logout' && tooltipPosition && <TooltipLabel text="Logout" position={tooltipPosition} />}
        </div>
      </div>

      {/* Add Server Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-[#1a1a2e] rounded-xl w-[400px] shadow-xl overflow-hidden">
            {/* Tab Header */}
            <div className="flex border-b border-zinc-700">
              <button
                onClick={() => setActiveTab('create')}
                className={cn(
                  "flex-1 py-3 text-sm font-medium transition-all",
                  activeTab === 'create'
                    ? "text-white bg-zinc-800/50 border-b-2 border-indigo-500"
                    : "text-zinc-400 hover:text-zinc-200"
                )}
              >
                Create Server
              </button>
              <button
                onClick={() => setActiveTab('join')}
                className={cn(
                  "flex-1 py-3 text-sm font-medium transition-all",
                  activeTab === 'join'
                    ? "text-white bg-zinc-800/50 border-b-2 border-indigo-500"
                    : "text-zinc-400 hover:text-zinc-200"
                )}
              >
                Join Server
              </button>
            </div>

            {/* Content */}
            <div className="p-5">
              {activeTab === 'create' ? (
                <>
                  <h3 className="text-lg font-bold text-white mb-1">Create a New Server</h3>
                  <p className="text-sm text-zinc-400 mb-4">Give your server a name to get started.</p>
                  <input
                    type="text"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="Server name"
                    className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 mb-4"
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateGroup()}
                    autoFocus
                  />
                </>
              ) : (
                <>
                  <h3 className="text-lg font-bold text-white mb-1">Join a Server</h3>
                  <p className="text-sm text-zinc-400 mb-4">Enter an invite code to join an existing server.</p>
                  <input
                    type="text"
                    value={joinInviteCode}
                    onChange={(e) => setJoinInviteCode(e.target.value.toUpperCase())}
                    placeholder="Invite Code (e.g. ABCD1234EFGH#1)"
                    className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 mb-2"
                    onKeyDown={(e) => e.key === 'Enter' && handleJoinGroup()}
                    autoFocus
                  />
                  {joinError && (
                    <p className="text-sm text-red-400 mb-2">{joinError}</p>
                  )}
                </>
              )}

              <div className="flex justify-end gap-2 mt-4">
                <button
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setNewGroupName('');
                    setJoinInviteCode('');
                    setJoinError('');
                  }}
                  className="px-4 py-2 rounded-lg text-zinc-400 hover:bg-zinc-700/30 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={activeTab === 'create' ? handleCreateGroup : handleJoinGroup}
                  disabled={activeTab === 'create' ? !newGroupName.trim() : !joinInviteCode.trim()}
                  className="px-4 py-2 rounded-lg bg-indigo-500 text-white hover:bg-indigo-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {activeTab === 'create' ? 'Create' : 'Join'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Group Confirmation Modal */}
      {deleteConfirm && (
        <ConfirmModal
          isOpen={true}
          title={`Delete Server "${deleteConfirm.name}"`}
          message="Are you sure you want to delete this server? This action cannot be undone."
          onConfirm={handleDeleteGroup}
          onCancel={() => setDeleteConfirm(null)}
          danger
        />
      )}
    </div>
  );
};

// Helper function
function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

function TooltipLabel({ text, position }: { text: string; position: { x: number; y: number } }) {
  return (
    <div
      className="pointer-events-none fixed z-[100] -translate-y-1/2"
      style={{ left: position.x, top: position.y }}
    >
      <div className="relative whitespace-nowrap rounded-md border border-zinc-700/60 bg-zinc-950/95 px-3 py-1.5 text-sm font-medium text-white shadow-xl">
        {text}
        <span className="absolute left-0 top-1/2 h-3 w-3 -translate-x-1.5 -translate-y-1/2 rotate-45 border-l border-t border-zinc-700/60 bg-zinc-950/95" />
      </div>
    </div>
  );
}

export default ServerList;
