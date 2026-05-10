"use client";
import React, { useState, useEffect } from 'react';
import { useChatStore } from '../../store/useChatStore';
import { useRouter } from 'next/navigation';
import { config } from '@/lib/config';
import ContextMenu from '../ui/ContextMenu';
import ConfirmModal from '../ui/ConfirmModal';

interface ServerListProps {
  isLoading?: boolean;
}

const ServerList: React.FC<ServerListProps> = ({ isLoading = false }) => {
  const currentUser = useChatStore((state) => state.currentUser);
  const currentGroupId = useChatStore((state) => state.currentGroupId);
  const setCurrentGroupId = useChatStore((state) => state.setCurrentGroupId);
  const setCurrentChannel = useChatStore((state) => state.setCurrentChannel);
  const logout = useChatStore((state) => state.logout);
  const router = useRouter();

  const [groups, setGroups] = useState<any[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'create' | 'join'>('create');
  const [newGroupName, setNewGroupName] = useState('');
  const [joinInviteCode, setJoinInviteCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; name: string } | null>(null);

  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
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
  };

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
        fetchGroups();
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
        fetchGroups();
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
        fetchGroups();
      } else {
        const data = await response.json().catch(() => ({}));
        setJoinError(data.message || 'Invalid invite code');
      }
    } catch (error) {
      setJoinError('Failed to join server');
    }
  };

  const handleGroupClick = (group: any) => {
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
    <div className="flex flex-col gap-2 items-center py-2 h-full">
      {/* Home/DM Button */}
      <button
        onClick={() => {
          setCurrentGroupId(null);
          setCurrentChannel(null);
          if (currentUser?.id) router.push(`/${currentUser.id}`);
        }}
        className={cn(
          "w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold transition-all",
          "bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 hover:rounded-xl"
        )}
        title="Home"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      </button>

      {/* Separator */}
      <div className="w-8 h-0.5 bg-zinc-700/50 rounded-full my-1" />

      {/* Server/Group Icons with Right-click Context Menu */}
      {groups.map((group) => (
        <ContextMenu
          key={group.id}
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
              "w-12 h-12 flex items-center justify-center text-lg font-bold transition-all",
              currentGroupId === group.id
                ? "rounded-xl bg-indigo-500 text-white shadow-lg"
                : "rounded-full bg-zinc-700/50 text-zinc-300 hover:bg-zinc-600/50 hover:rounded-xl"
            )}
            title={group.name}
          >
            {group.icon ? (
              <span className="text-2xl">{group.icon}</span>
            ) : (
              getInitial(group.name)
            )}
          </button>
        </ContextMenu>
      ))}

      {/* Add Server Button */}
      <button
        onClick={() => { setIsAddModalOpen(true); setActiveTab('create'); setJoinError(''); }}
        className="w-12 h-12 rounded-full bg-zinc-700/50 text-zinc-400 hover:bg-green-500/20 hover:text-green-400 hover:rounded-xl flex items-center justify-center transition-all"
        title="Add a Server"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>

      {/* Spacer */}
      <div className="flex-1" />

      {/* User Avatar */}
      <button
        onClick={() => router.push('/profile')}
        className="w-12 h-12 rounded-full bg-zinc-700/50 hover:rounded-xl flex items-center justify-center overflow-hidden transition-all"
        title={currentUser?.username}
      >
        {currentUser?.avatarUrl ? (
          <img src={`${config.api.baseUrl}${currentUser.avatarUrl}`} alt="Avatar" className="w-full h-full object-cover" />
        ) : (
          <span className="text-lg font-bold text-zinc-300">
            {currentUser?.username?.charAt(0)?.toUpperCase() || 'U'}
          </span>
        )}
      </button>

      {/* Logout Button */}
      <button
        onClick={handleLogout}
        className="w-12 h-12 rounded-full bg-zinc-700/50 hover:bg-red-500/20 hover:text-red-400 hover:rounded-xl flex items-center justify-center text-zinc-400 transition-all"
        title="Logout"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
      </button>

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

export default ServerList;
