"use client";
/* eslint-disable @next/next/no-img-element */
import React, { useState, useEffect, useCallback } from 'react';
import { useChatStore } from '../../store/useChatStore';
import { usePathname, useRouter } from 'next/navigation';
import { Plus, Search, Users, X } from 'lucide-react';
import api from '@/lib/api';
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
      const data = await api.get<Group[]>('/api/groups');
      setGroups(Array.isArray(data) ? data : []);
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
      await api.post<Group>('/api/groups', { name: newGroupName });
      setNewGroupName('');
      setIsAddModalOpen(false);
      void fetchGroups();
    } catch (error) {
      console.error('Failed to create group:', error);
    }
  };

  const handleDeleteGroup = async () => {
    if (!deleteConfirm) return;
    try {
      await api.delete<null>(`/api/groups/${deleteConfirm.id}`);
      if (currentGroupId === deleteConfirm.id) {
        setCurrentGroupId(null);
        setCurrentChannel(null);
      }
      void fetchGroups();
    } catch (error) {
      console.error('Failed to delete group:', error);
    }
    setDeleteConfirm(null);
  };

  const handleJoinGroup = async () => {
    const inviteCode = normalizeInviteInput(joinInviteCode);
    if (!inviteCode) return;
    setJoinError('');
    try {
      await api.post<Group>(`/api/groups/join/${encodeURIComponent(inviteCode)}`, null);
      setJoinInviteCode('');
      setIsAddModalOpen(false);
      void fetchGroups();
    } catch (error) {
      setJoinError(error instanceof Error ? error.message : 'Failed to join server');
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
      await api.post<null>('/api/auth/logout', null).catch(() => {});
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
            onClick={() => { setIsAddModalOpen(true); setJoinError(''); }}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4">
          <div className="w-full max-w-[460px] overflow-hidden rounded-[22px] bg-[#17172a] text-zinc-100 shadow-2xl ring-1 ring-white/5">
            <div className="relative flex h-16 items-center justify-center border-b border-white/8">
              <h2 className="text-[20px] font-semibold leading-none tracking-normal text-white">创建或加入域</h2>
              <button
                type="button"
                onClick={() => {
                  setIsAddModalOpen(false);
                  setNewGroupName('');
                  setJoinInviteCode('');
                  setJoinError('');
                }}
                className="absolute right-4 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-white/8 hover:text-white"
                aria-label="关闭"
              >
                <X className="h-6 w-6" strokeWidth={1.8} />
              </button>
            </div>

            <div className="space-y-3 p-4">
              <div className="rounded-[18px] border border-white/8 bg-white/5 p-4 shadow-[0_1px_0_rgba(255,255,255,0.03)]">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-400/12 text-indigo-200 ring-1 ring-indigo-400/20">
                    <Plus className="h-4 w-4" strokeWidth={2.3} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-[15px] font-medium leading-6 text-white">创建</h3>
                    <p className="mt-0.5 text-[13px] leading-5 text-zinc-400">自己创建一个域并邀请伙伴加入</p>
                  </div>
                </div>

                <div className="mt-4 flex h-11 items-center rounded-full border border-white/8 bg-black/20 px-4 focus-within:border-indigo-400/50">
                  <input
                    type="text"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="请输入域名称"
                    className="min-w-0 flex-1 bg-transparent text-[14px] text-white outline-none placeholder:text-zinc-500"
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateGroup()}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={handleCreateGroup}
                    disabled={!newGroupName.trim()}
                    className="ml-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-indigo-300 transition-colors hover:bg-indigo-400/15 hover:text-white disabled:text-zinc-600"
                    aria-label="创建域"
                  >
                    <Plus className="h-5 w-5" strokeWidth={2.2} />
                  </button>
                </div>
              </div>

              <div className="rounded-[18px] border border-white/8 bg-white/5 p-4 shadow-[0_1px_0_rgba(255,255,255,0.03)]">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-400/12 text-sky-200 ring-1 ring-sky-400/20">
                    <Users className="h-4 w-4" strokeWidth={2.2} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-[15px] font-medium leading-6 text-white">加入</h3>
                    <p className="mt-0.5 text-[13px] leading-5 text-zinc-400">输入邀请码/邀请链接进行搜索</p>
                  </div>
                </div>

                <div className="mt-4 flex h-11 items-center rounded-full border border-white/8 bg-black/20 px-4 focus-within:border-sky-400/50">
                  <input
                    type="text"
                    value={joinInviteCode}
                    onChange={(e) => {
                      setJoinInviteCode(e.target.value);
                      setJoinError('');
                    }}
                    placeholder="请输入邀请码/邀请链接"
                    className="min-w-0 flex-1 bg-transparent text-[14px] text-white outline-none placeholder:text-zinc-500"
                    onKeyDown={(e) => e.key === 'Enter' && handleJoinGroup()}
                  />
                  <button
                    type="button"
                    onClick={handleJoinGroup}
                    disabled={!joinInviteCode.trim()}
                    className="ml-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sky-300 transition-colors hover:bg-sky-400/15 hover:text-white disabled:text-zinc-600"
                    aria-label="搜索并加入域"
                  >
                    <Search className="h-5 w-5" strokeWidth={2.2} />
                  </button>
                </div>
                {joinError && <p className="mt-3 text-[13px] leading-5 text-red-400">{joinError}</p>}
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

function normalizeInviteInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';
  try {
    const url = new URL(trimmed);
    const lastSegment = url.pathname.split('/').filter(Boolean).pop() || trimmed;
    return decodeURIComponent(lastSegment).replace(/_(\d+)$/, '#$1');
  } catch {
    return trimmed.replace(/_(\d+)$/, '#$1');
  }
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
