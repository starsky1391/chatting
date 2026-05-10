"use client";
import React, { useState, useEffect } from 'react';
import { useChatStore } from '../../store/useChatStore';
import { useRouter } from 'next/navigation';
import { config } from '@/lib/config';
import ContextMenu from '../ui/ContextMenu';
import ConfirmModal from '../ui/ConfirmModal';

interface ChannelGroup {
  id: number;
  name: string;
  description: string;
  icon: string;
  ownerId: number;
  inviteCode: string;
  inviteLink?: string;
  textChannels: Channel[];
  voiceChannels: Channel[];
  members: Member[];
}

interface Channel {
  id: number;
  name: string;
  type: string;
  description: string;
  groupId: number;
  position: number;
  createdBy: number;
}

interface Member {
  id: number;
  username: string;
  avatar: string;
  isOnline: boolean;
}

interface ChannelListProps {
  isLoading?: boolean;
}

const ChannelList: React.FC<ChannelListProps> = ({ isLoading = false }) => {
  const currentChannel = useChatStore((state) => state.currentChannel);
  const currentGroupId = useChatStore((state) => state.currentGroupId);
  const currentUser = useChatStore((state) => state.currentUser);
  const setCurrentChannel = useChatStore((state) => state.setCurrentChannel);
  const setCurrentGroupId = useChatStore((state) => state.setCurrentGroupId);
  const addChannel = useChatStore((state) => state.addChannel);
  const router = useRouter();

  const [groups, setGroups] = useState<ChannelGroup[]>([]);
  const [currentGroup, setCurrentGroup] = useState<ChannelGroup | null>(null);
  const [isCreateChannelOpen, setIsCreateChannelOpen] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelType, setNewChannelType] = useState<'text' | 'voice'>('text');
  const [loading, setLoading] = useState(true);

  // Delete confirmation state
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: 'group' | 'channel';
    id: number;
    groupId?: number;
    name: string;
  } | null>(null);

  useEffect(() => {
    fetchGroups();
  }, [currentGroupId]);

  const fetchGroups = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${config.api.baseUrl}/api/groups`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setGroups(data.data || []);
        // Find current group
        const group = (data.data || []).find((g: ChannelGroup) => g.id === currentGroupId);
        if (group) {
          setCurrentGroup(group);
        }
      }
    } catch (error) {
      console.error('Failed to fetch groups:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChannelClick = (channel: Channel) => {
    setCurrentChannel({
      id: channel.id,
      name: channel.name,
      type: channel.type as 'text' | 'voice',
      groupId: channel.groupId
    });
  };

  const handleCreateChannel = async () => {
    if (!newChannelName.trim() || !currentGroup) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${config.api.baseUrl}/api/groups/${currentGroup.id}/channels`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: newChannelName,
          type: newChannelType,
          groupId: currentGroup.id
        })
      });

      if (response.ok) {
        const data = await response.json();
        fetchGroups();
        setNewChannelName('');
        setIsCreateChannelOpen(false);
      }
    } catch (error) {
      console.error('Failed to create channel:', error);
    }
  };

  const handleDeleteChannel = async (channelId: number, groupId: number) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${config.api.baseUrl}/api/groups/${groupId}/channels/${channelId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        fetchGroups();
        if (currentChannel?.id === channelId) {
          setCurrentChannel(null);
        }
      }
    } catch (error) {
      console.error('Failed to delete channel:', error);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return;

    if (deleteConfirm.type === 'channel' && deleteConfirm.groupId) {
      await handleDeleteChannel(deleteConfirm.id, deleteConfirm.groupId);
    }

    setDeleteConfirm(null);
  };

  if (loading || isLoading) {
    return (
      <div className="flex flex-col h-full p-2">
        <div className="animate-pulse space-y-2">
          <div className="h-8 bg-zinc-700/50 rounded-lg" />
          <div className="h-6 bg-zinc-700/50 rounded-lg" />
          <div className="h-6 bg-zinc-700/50 rounded-lg" />
          <div className="h-6 bg-zinc-700/50 rounded-lg" />
        </div>
      </div>
    );
  }

  if (!currentGroup) {
    return (
      <div className="flex flex-col h-full items-center justify-center text-zinc-500 p-4">
        <svg className="w-12 h-12 mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
        <p className="text-sm">Select a server</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Server Header */}
      <div className="p-3 border-b border-zinc-700/50">
        <h2 className="text-lg font-bold text-white truncate">{currentGroup.name}</h2>
        {currentGroup.description && (
          <p className="text-xs text-zinc-500 mt-1 truncate">{currentGroup.description}</p>
        )}
        {/* Invite Code - Direct display with copy */}
        {(currentGroup.inviteCode || currentGroup.inviteLink) && (
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs text-zinc-500">邀请码:</span>
            <code className="text-xs bg-zinc-700/50 px-2 py-0.5 rounded text-indigo-400 font-mono">
              {currentGroup.inviteLink || currentGroup.inviteCode}
            </code>
            <button
              onClick={() => {
                const inviteLink = currentGroup.inviteLink || currentGroup.inviteCode;
                // 只复制邀请码
                navigator.clipboard.writeText(inviteLink);
              }}
              className="p-1 rounded hover:bg-zinc-700/50 text-zinc-400 hover:text-white transition-all"
              title="复制邀请码"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Channel List */}
      <div className="flex-1 overflow-y-auto p-2">
        {/* Text Channels */}
        <div className="mb-4">
          <div className="flex items-center justify-between px-2 py-1.5 mb-1">
            <span className="text-xs font-semibold text-zinc-400 uppercase">Text Channels</span>
            <button
              onClick={() => setIsCreateChannelOpen(true)}
              className="p-1 rounded hover:bg-zinc-700/50 text-zinc-400 transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
          {currentGroup.textChannels?.map((channel) => (
            <ContextMenu
              key={channel.id}
              items={[
                {
                  label: 'Delete Channel',
                  icon: (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.846L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  ),
                  onClick: () => setDeleteConfirm({ type: 'channel', id: channel.id, groupId: currentGroup.id, name: channel.name }),
                  danger: true,
                  disabled: currentGroup.ownerId !== currentUser?.id
                }
              ]}
            >
              <button
                onClick={() => handleChannelClick(channel)}
                className={cn(
                  "w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all",
                  currentChannel?.id === channel.id
                    ? "bg-indigo-500/20 text-white"
                    : "text-zinc-400 hover:bg-zinc-700/30 hover:text-zinc-200"
                )}
              >
                <span className="text-zinc-500">#</span>
                <span className="text-sm truncate">{channel.name}</span>
              </button>
            </ContextMenu>
          ))}
        </div>

        {/* Voice Channels */}
        <div className="mb-4">
          <div className="flex items-center justify-between px-2 py-1.5 mb-1">
            <span className="text-xs font-semibold text-zinc-400 uppercase">Voice Channels</span>
          </div>
          {currentGroup.voiceChannels?.map((channel) => (
            <ContextMenu
              key={channel.id}
              items={[
                {
                  label: 'Delete Channel',
                  icon: (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.846L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  ),
                  onClick: () => setDeleteConfirm({ type: 'channel', id: channel.id, groupId: currentGroup.id, name: channel.name }),
                  danger: true,
                  disabled: currentGroup.ownerId !== currentUser?.id
                }
              ]}
            >
              <button
                onClick={() => handleChannelClick(channel)}
                className={cn(
                  "w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all",
                  currentChannel?.id === channel.id
                    ? "bg-indigo-500/20 text-white"
                    : "text-zinc-400 hover:bg-zinc-700/30 hover:text-zinc-200"
                )}
              >
                <span className="text-zinc-500">🔊</span>
                <span className="text-sm truncate">{channel.name}</span>
              </button>
            </ContextMenu>
          ))}
        </div>
      </div>

      {/* User Panel - Fixed at bottom */}
      <div className="p-2 border-t border-zinc-700/50 bg-zinc-800/30">
        <button
          onClick={() => {
            const user = localStorage.getItem('user');
            if (user) {
              try {
                const userData = JSON.parse(user);
                router.push(`/${userData.id}`);
              } catch {
                router.push('/profile');
              }
            } else {
              router.push('/profile');
            }
          }}
          className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-zinc-700/30 transition-all"
        >
          <div className="relative">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center overflow-hidden">
              {currentUser?.avatarUrl ? (
                <img src={`${config.api.baseUrl}${currentUser.avatarUrl}`} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                currentUser?.username?.charAt(0)?.toUpperCase() || 'U'
              )}
            </div>
            <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-zinc-800 ${currentUser?.isOnline ? 'bg-green-500' : 'bg-zinc-500'}`} />
          </div>
          <div className="flex flex-col text-left min-w-0">
            <span className="text-sm font-medium text-white truncate">{currentUser?.username}</span>
            <span className="text-xs text-zinc-500">{currentUser?.isOnline ? 'Online' : 'Offline'}</span>
          </div>
        </button>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <ConfirmModal
          isOpen={true}
          title={`Delete ${deleteConfirm.type === 'channel' ? 'Channel' : 'Group'}`}
          message={`Are you sure you want to delete "${deleteConfirm.name}"? This action cannot be undone.`}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteConfirm(null)}
          danger
        />
      )}

      {/* Create Channel Modal */}
      {isCreateChannelOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-[#1a1a2e] rounded-xl p-4 w-[300px] shadow-xl">
            <h3 className="text-lg font-bold text-white mb-4">Create Channel</h3>
            <input
              type="text"
              value={newChannelName}
              onChange={(e) => setNewChannelName(e.target.value)}
              placeholder="Channel name"
              className="w-full px-3 py-2 bg-zinc-700/50 border border-zinc-600 rounded-lg text-white focus:outline-none focus:border-indigo-500 mb-3"
            />
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setNewChannelType('text')}
                className={cn(
                  "flex-1 py-2 rounded-lg text-sm transition-all",
                  newChannelType === 'text'
                    ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/50"
                    : "bg-zinc-700/30 text-zinc-400 border border-zinc-700"
                )}
              >
                # Text
              </button>
              <button
                onClick={() => setNewChannelType('voice')}
                className={cn(
                  "flex-1 py-2 rounded-lg text-sm transition-all",
                  newChannelType === 'voice'
                    ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/50"
                    : "bg-zinc-700/30 text-zinc-400 border border-zinc-700"
                )}
              >
                🔊 Voice
              </button>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsCreateChannelOpen(false)}
                className="px-4 py-2 rounded-lg text-zinc-400 hover:bg-zinc-700/30 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateChannel}
                className="px-4 py-2 rounded-lg bg-indigo-500 text-white hover:bg-indigo-600 transition-all"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

export default ChannelList;