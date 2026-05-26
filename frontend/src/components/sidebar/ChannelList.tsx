"use client";
/* eslint-disable @next/next/no-img-element */
import React, { useState, useEffect, useCallback } from 'react';
import { useChatStore } from '../../store/useChatStore';
import { useRouter } from 'next/navigation';
import { config } from '@/lib/config';
import { onWebSocketMessage } from '@/lib/socket';
import ContextMenu from '../ui/ContextMenu';
import ConfirmModal from '../ui/ConfirmModal';
import GroupSettingsModal from '../group/GroupSettingsModal';
import { Hash, Pencil, Plus, Settings, Trash2, Users, Volume2 } from 'lucide-react';

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
  roles?: GroupRole[];
}

interface GroupRole {
  id: number;
  groupId: number;
  name: string;
  description: string;
  color: string;
  position: number;
  isDefault: boolean;
  isSystem: boolean;
}

interface Channel {
  id: number;
  name: string;
  type: string;
  description: string;
  groupId: number;
  position: number;
  createdBy: number;
  maxMembers?: number;
}

interface Member {
  id: number;
  username: string;
  avatar: string;
  isOnline: boolean;
  role?: string;
  groupRole?: string;
}

interface ChannelListProps {
  isLoading?: boolean;
}

const ChannelList: React.FC<ChannelListProps> = ({ isLoading = false }) => {
  const currentChannel = useChatStore((state) => state.currentChannel);
  const currentGroupId = useChatStore((state) => state.currentGroupId);
  const currentUser = useChatStore((state) => state.currentUser);
  const setCurrentChannel = useChatStore((state) => state.setCurrentChannel);
  const router = useRouter();

  const [currentGroup, setCurrentGroup] = useState<ChannelGroup | null>(null);
  const [isCreateChannelOpen, setIsCreateChannelOpen] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelType, setNewChannelType] = useState<'text' | 'voice'>('text');
  const [newChannelMaxMembers, setNewChannelMaxMembers] = useState(100);
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null);
  const [editChannelName, setEditChannelName] = useState('');
  const [editChannelMaxMembers, setEditChannelMaxMembers] = useState(100);
  const [isGroupSettingsOpen, setIsGroupSettingsOpen] = useState(false);
  const [channelError, setChannelError] = useState('');
  const [voiceParticipantCounts, setVoiceParticipantCounts] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);

  // Delete confirmation state
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: 'group' | 'channel';
    id: number;
    groupId?: number;
    name: string;
  } | null>(null);

  const loadVoiceParticipantCounts = useCallback(async (channels: Channel[]) => {
    const token = localStorage.getItem('token');
    const voiceChannels = channels.filter((channel) => channel.type === 'voice');
    if (voiceChannels.length === 0) {
      setVoiceParticipantCounts({});
      return;
    }

    const entries = await Promise.all(
      voiceChannels.map(async (channel) => {
        try {
          const response = await fetch(`${config.api.baseUrl}/api/voice/${channel.id}/participants`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const data = await response.json().catch(() => ({}));
          return [channel.id, Array.isArray(data.data) ? data.data.length : 0] as const;
        } catch {
          return [channel.id, 0] as const;
        }
      })
    );
    setVoiceParticipantCounts(Object.fromEntries(entries));
  }, []);

  const fetchGroups = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${config.api.baseUrl}/api/groups`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        const groupsData = Array.isArray(data.data) ? (data.data as ChannelGroup[]) : [];
        // Find current group
        const group = groupsData.find((g) => g.id === currentGroupId);
        if (group) {
          setCurrentGroup(group);
          await loadVoiceParticipantCounts(group.voiceChannels || []);
        } else {
          setCurrentGroup(null);
          setVoiceParticipantCounts({});
        }
      } else {
        setCurrentGroup(null);
        setVoiceParticipantCounts({});
      }
    } catch (error) {
      console.error('Failed to fetch groups:', error);
      setCurrentGroup(null);
      setVoiceParticipantCounts({});
    } finally {
      setLoading(false);
    }
  }, [currentGroupId, loadVoiceParticipantCounts]);

  useEffect(() => {
    queueMicrotask(() => {
      void fetchGroups();
    });
  }, [fetchGroups]);

  useEffect(() => {
    const unsubscribe = onWebSocketMessage('voice:call-status', (rawData) => {
      const data = rawData as {
        channelId?: number;
        action?: 'join' | 'leave';
        participantCount?: number;
      };
      const channelId = data.channelId;
      if (typeof channelId !== 'number') return;

      setVoiceParticipantCounts((counts) => {
        const next = { ...counts };
        if (typeof data.participantCount === 'number') {
          next[channelId] = data.participantCount;
          return next;
        }

        const currentCount = next[channelId] || 0;
        if (data.action === 'join') {
          next[channelId] = currentCount + 1;
        } else if (data.action === 'leave') {
          next[channelId] = Math.max(0, currentCount - 1);
        }
        return next;
      });
    });

    return unsubscribe;
  }, []);

  const handleChannelClick = (channel: Channel) => {
    setCurrentChannel({
      id: channel.id,
      name: channel.name,
      type: channel.type as 'text' | 'voice',
      groupId: channel.groupId,
      maxMembers: channel.maxMembers
    });
  };

  const openGroupSettings = () => {
    if (!currentGroup) return;
    setIsGroupSettingsOpen(true);
  };

  const openCreateChannel = () => {
    setChannelError('');
    setNewChannelName('');
    setNewChannelType('text');
    setNewChannelMaxMembers(100);
    setIsCreateChannelOpen(true);
  };

  const handleCreateChannel = async () => {
    if (!newChannelName.trim() || !currentGroup) return;
    setChannelError('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${config.api.baseUrl}/api/groups/${currentGroup.id}/channels`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: newChannelName.trim(),
          type: newChannelType,
          groupId: currentGroup.id,
          maxMembers: newChannelType === 'voice' ? newChannelMaxMembers : 0
        })
      });

      if (response.ok) {
        fetchGroups();
        setNewChannelName('');
        setNewChannelMaxMembers(100);
        setIsCreateChannelOpen(false);
      } else {
        const data = await response.json().catch(() => ({}));
        setChannelError(data.error || data.message || '创建频道失败');
      }
    } catch (error) {
      console.error('Failed to create channel:', error);
      setChannelError('创建频道失败');
    }
  };

  const openEditChannel = (channel: Channel) => {
    setChannelError('');
    setEditingChannel(channel);
    setEditChannelName(channel.name);
    setEditChannelMaxMembers(channel.maxMembers || 0);
  };

  const handleUpdateChannel = async () => {
    if (!editingChannel || !currentGroup || !editChannelName.trim()) return;
    setChannelError('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${config.api.baseUrl}/api/groups/${currentGroup.id}/channels/${editingChannel.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: editChannelName.trim(),
          description: editingChannel.description,
          maxMembers: editingChannel.type === 'voice' ? editChannelMaxMembers : 0
        })
      });

      if (response.ok) {
        const payload = await response.json().catch(() => ({}));
        const updated = payload.data as Channel | undefined;
        await fetchGroups();
        if (updated && currentChannel?.id === updated.id) {
          setCurrentChannel({
            id: updated.id,
            name: updated.name,
            type: updated.type as 'text' | 'voice',
            groupId: updated.groupId,
            maxMembers: updated.maxMembers
          });
        }
        setEditingChannel(null);
      } else {
        const data = await response.json().catch(() => ({}));
        setChannelError(data.error || data.message || '更新频道失败');
      }
    } catch (error) {
      console.error('Failed to update channel:', error);
      setChannelError('更新频道失败');
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

  const currentMembership = currentGroup.members?.find((member) => member.id === currentUser?.id);
  const canManageGroup =
    currentGroup.ownerId === currentUser?.id ||
    currentMembership?.groupRole === 'admin' ||
    currentMembership?.role === 'admin';

  return (
    <div className="flex flex-col h-full">
      {/* Server Header */}
      <div className="p-3 border-b border-zinc-700/50">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-white truncate">{currentGroup.name}</h2>
            {currentGroup.description && (
              <p className="text-xs text-zinc-500 mt-1 truncate">{currentGroup.description}</p>
            )}
          </div>
          {canManageGroup && (
            <button
              onClick={openGroupSettings}
              className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition-all hover:bg-zinc-700/50 hover:text-white"
              title="群组设置"
            >
              <Settings className="h-4 w-4" />
            </button>
          )}
        </div>
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
      <div className="no-scrollbar flex-1 overflow-y-auto p-2">
        <button
          onClick={openCreateChannel}
          className="mb-3 flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800/60 px-3 py-2 text-sm font-medium text-zinc-200 transition-all hover:border-indigo-500/50 hover:bg-indigo-500/15 hover:text-white"
          title="创建频道"
        >
          <Plus className="h-4 w-4" />
          创建频道
        </button>

        {/* Text Channels */}
        <div className="mb-4">
          <div className="flex items-center justify-between px-2 py-1.5 mb-1">
            <span className="text-xs font-semibold text-zinc-400 uppercase">Text Channels</span>
          </div>
          <div className="space-y-0.5">
            {currentGroup.textChannels?.map((channel) => (
              <ContextMenu
                key={channel.id}
                wrapperClassName="block w-full"
                items={[
                  {
                    label: 'Edit Channel',
                    icon: <Pencil className="w-4 h-4" />,
                    onClick: () => openEditChannel(channel),
                    disabled: currentGroup.ownerId !== currentUser?.id && channel.createdBy !== currentUser?.id
                  },
                  {
                    label: 'Delete Channel',
                    icon: <Trash2 className="w-4 h-4" />,
                    onClick: () => setDeleteConfirm({ type: 'channel', id: channel.id, groupId: currentGroup.id, name: channel.name }),
                    danger: true,
                    disabled: currentGroup.ownerId !== currentUser?.id && channel.createdBy !== currentUser?.id
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
                  <Hash className="h-4 w-4 shrink-0 text-zinc-500" />
                  <span className="text-sm truncate">{channel.name}</span>
                </button>
              </ContextMenu>
            ))}
          </div>
        </div>

        {/* Voice Channels */}
        <div className="mb-4">
          <div className="flex items-center justify-between px-2 py-1.5 mb-1">
            <span className="text-xs font-semibold text-zinc-400 uppercase">Voice Channels</span>
          </div>
          <div className="space-y-1.5">
            {currentGroup.voiceChannels?.map((channel) => {
              const currentMembers = voiceParticipantCounts[channel.id] || 0;
              const maxMembers = channel.maxMembers || 0;
              const isFull = maxMembers > 0 && currentMembers >= maxMembers;
              return (
                <ContextMenu
                  key={channel.id}
                  wrapperClassName="block w-full"
                  items={[
                    {
                      label: 'Edit Channel',
                      icon: <Pencil className="w-4 h-4" />,
                      onClick: () => openEditChannel(channel),
                      disabled: currentGroup.ownerId !== currentUser?.id && channel.createdBy !== currentUser?.id
                    },
                    {
                      label: 'Delete Channel',
                      icon: <Trash2 className="w-4 h-4" />,
                      onClick: () => setDeleteConfirm({ type: 'channel', id: channel.id, groupId: currentGroup.id, name: channel.name }),
                      danger: true,
                      disabled: currentGroup.ownerId !== currentUser?.id && channel.createdBy !== currentUser?.id
                    }
                  ]}
                >
                  <button
                    onClick={() => handleChannelClick(channel)}
                    className={cn(
                      "w-full rounded-lg px-2.5 py-2 text-left transition-all",
                      currentChannel?.id === channel.id
                        ? "bg-indigo-500/20 text-white ring-1 ring-indigo-500/30"
                        : "text-zinc-400 hover:bg-zinc-700/30 hover:text-zinc-200",
                      isFull && currentChannel?.id !== channel.id && "opacity-75"
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
                        currentChannel?.id === channel.id ? "bg-indigo-500/25 text-indigo-200" : "bg-zinc-800 text-zinc-400"
                      )}>
                        <Volume2 className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="truncate text-sm font-medium">{channel.name}</span>
                          {isFull && <span className="shrink-0 rounded bg-red-500/15 px-1.5 py-0.5 text-[10px] text-red-300">已满</span>}
                        </div>
                        <div className="mt-0.5 flex items-center gap-1 text-[11px] text-zinc-500">
                          <Users className="h-3 w-3" />
                          <span>{currentMembers}/{maxMembers > 0 ? maxMembers : '不限'}</span>
                        </div>
                      </div>
                    </div>
                  </button>
                </ContextMenu>
              );
            })}
          </div>
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

      <GroupSettingsModal
        isOpen={isGroupSettingsOpen && canManageGroup}
        group={currentGroup}
        currentUserId={currentUser?.id}
        onClose={() => setIsGroupSettingsOpen(false)}
        onSaved={() => {
          void fetchGroups();
          window.dispatchEvent(new Event('groups:refresh'));
        }}
      />

      {/* Create Channel Modal */}
      {isCreateChannelOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-[#1a1a2e] rounded-xl p-4 w-[340px] shadow-xl">
            <h3 className="text-lg font-bold text-white mb-4">Create Channel</h3>
            {channelError && (
              <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {channelError}
              </div>
            )}
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
            {newChannelType === 'voice' && (
              <label className="mb-4 block">
                <span className="mb-1 block text-xs font-medium text-zinc-400">频道人数上限</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={newChannelMaxMembers}
                  onChange={(event) => setNewChannelMaxMembers(Math.max(0, Math.min(100, Number(event.target.value) || 0)))}
                  className="w-full rounded-lg border border-zinc-600 bg-zinc-700/50 px-3 py-2 text-white outline-none focus:border-indigo-500"
                />
                <span className="mt-1 block text-xs text-zinc-500">默认 100 人，0 表示不限制人数。</span>
              </label>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setIsCreateChannelOpen(false); setChannelError(''); }}
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

      {/* Edit Channel Modal */}
      {editingChannel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-[340px] rounded-xl bg-[#1a1a2e] p-4 shadow-xl">
            <h3 className="mb-4 text-lg font-bold text-white">Edit Channel</h3>
            {channelError && (
              <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {channelError}
              </div>
            )}
            <label className="mb-3 block">
              <span className="mb-1 block text-xs font-medium text-zinc-400">频道名称</span>
              <input
                type="text"
                value={editChannelName}
                onChange={(e) => setEditChannelName(e.target.value)}
                placeholder="Channel name"
                className="w-full rounded-lg border border-zinc-600 bg-zinc-700/50 px-3 py-2 text-white outline-none focus:border-indigo-500"
              />
            </label>

            {editingChannel.type === 'voice' && (
              <label className="mb-4 block">
                <span className="mb-1 block text-xs font-medium text-zinc-400">频道人数上限</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={editChannelMaxMembers}
                  onChange={(event) => setEditChannelMaxMembers(Math.max(0, Math.min(100, Number(event.target.value) || 0)))}
                  className="w-full rounded-lg border border-zinc-600 bg-zinc-700/50 px-3 py-2 text-white outline-none focus:border-indigo-500"
                />
                <span className="mt-1 block text-xs text-zinc-500">0 表示不限制人数；保存后新加入会按该上限校验。</span>
              </label>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setEditingChannel(null); setChannelError(''); }}
                className="rounded-lg px-4 py-2 text-zinc-400 transition-all hover:bg-zinc-700/30"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateChannel}
                className="rounded-lg bg-indigo-500 px-4 py-2 text-white transition-all hover:bg-indigo-600"
              >
                Save
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
