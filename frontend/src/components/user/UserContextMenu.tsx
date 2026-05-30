"use client";
/* eslint-disable @next/next/no-img-element */

import React, { MouseEvent, useCallback, useEffect, useId, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Ban, Check, Copy, MessageCircle, User, UserMinus, UserPlus, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { config } from '@/lib/config';
import { useChatStore } from '@/store/useChatStore';

export type ContextMenuUser = {
  id: number;
  username: string;
  email?: string;
  avatar?: string;
  avatarUrl?: string;
  role?: string;
  bio?: string;
  isOnline?: boolean;
};

type FriendRelationUser = {
  id: number;
};

type Friendship = {
  id: number;
  friend: FriendRelationUser;
};

type FriendRequest = {
  id: number;
  requester: FriendRelationUser;
  addressee: FriendRelationUser;
  status: string;
};

type DirectConversation = {
  id: number;
};

type Relationship =
  | { status: 'loading' }
  | { status: 'none' }
  | { status: 'friend' }
  | { status: 'incoming'; requestId: number }
  | { status: 'outgoing'; requestId: number }
  | { status: 'self' };

type MenuState = {
  user: ContextMenuUser;
  x: number;
  y: number;
};

const MENU_WIDTH = 240;
const MENU_HEIGHT = 360;
const MENU_GAP = 8;
const OPEN_MENU_EVENT = 'chat:user-context-menu-open';

function getAvatarUrl(user: ContextMenuUser) {
  if (!user.avatarUrl) return '';
  if (user.avatarUrl.startsWith('http')) return user.avatarUrl;
  return `${config.api.baseUrl}${user.avatarUrl}`;
}

function getInitial(user: ContextMenuUser) {
  return user.avatar || user.username?.charAt(0)?.toUpperCase() || 'U';
}

function clampPosition(x: number, y: number) {
  if (typeof window === 'undefined') return { x, y };
  return {
    x: Math.max(MENU_GAP, Math.min(x, window.innerWidth - MENU_WIDTH - MENU_GAP)),
    y: Math.max(MENU_GAP, Math.min(y, window.innerHeight - MENU_HEIGHT - MENU_GAP)),
  };
}

function getAnchorPosition(anchor: Element) {
  const rect = anchor.getBoundingClientRect();
  const preferRight = rect.left + rect.width + MENU_GAP + MENU_WIDTH <= window.innerWidth;
  const x = preferRight ? rect.right + MENU_GAP : rect.left - MENU_WIDTH - MENU_GAP;
  return clampPosition(x, rect.top);
}

export function useUserContextMenu() {
  const [menu, setMenu] = useState<MenuState | null>(null);
  const instanceId = useId();

  const notifyOpen = useCallback(() => {
    window.dispatchEvent(
      new CustomEvent(OPEN_MENU_EVENT, {
        detail: { instanceId },
      })
    );
  }, [instanceId]);

  const openUserMenu = useCallback((event: MouseEvent, user: ContextMenuUser) => {
    event.preventDefault();
    event.stopPropagation();
    notifyOpen();
    const anchor = event.currentTarget instanceof Element ? event.currentTarget : null;
    const position = anchor ? getAnchorPosition(anchor) : clampPosition(event.clientX, event.clientY);
    setMenu({ user, ...position });
  }, [notifyOpen]);

  const openUserMenuAtElement = useCallback((anchor: Element, user: ContextMenuUser) => {
    notifyOpen();
    setMenu({ user, ...getAnchorPosition(anchor) });
  }, [notifyOpen]);

  const closeUserMenu = useCallback(() => setMenu(null), []);

  useEffect(() => {
    const handleOtherMenuOpen = (event: Event) => {
      const customEvent = event as CustomEvent<{ instanceId?: string }>;
      if (customEvent.detail?.instanceId !== instanceId) {
        setMenu(null);
      }
    };

    window.addEventListener(OPEN_MENU_EVENT, handleOtherMenuOpen);
    return () => window.removeEventListener(OPEN_MENU_EVENT, handleOtherMenuOpen);
  }, [instanceId]);

  return { menu, openUserMenu, openUserMenuAtElement, closeUserMenu };
}

export function UserContextMenu({
  menu,
  onClose,
}: {
  menu: MenuState | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const currentUser = useChatStore((state) => state.currentUser);
  const [relationship, setRelationship] = useState<Relationship>({ status: 'none' });
  const [profileUser, setProfileUser] = useState<ContextMenuUser | null>(null);
  const [feedback, setFeedback] = useState('');

  const user = menu?.user || null;
  const imageUrl = user ? getAvatarUrl(user) : '';

  const isSelf = Boolean(user && currentUser?.id === user.id);

  const loadRelationship = useCallback(async (targetUserId: number) => {
    if (currentUser?.id === targetUserId) {
      setRelationship({ status: 'self' });
      return;
    }

    setRelationship({ status: 'loading' });
    try {
      const [friends, incoming, outgoing] = await Promise.all([
        api.get<Friendship[]>('/api/friends'),
        api.get<FriendRequest[]>('/api/friends/requests/incoming'),
        api.get<FriendRequest[]>('/api/friends/requests/outgoing'),
      ]);

      if (Array.isArray(friends) && friends.some((item) => item.friend.id === targetUserId)) {
        setRelationship({ status: 'friend' });
        return;
      }

      const incomingRequest = Array.isArray(incoming)
        ? incoming.find((item) => item.requester.id === targetUserId && item.status === 'pending')
        : undefined;
      if (incomingRequest) {
        setRelationship({ status: 'incoming', requestId: incomingRequest.id });
        return;
      }

      const outgoingRequest = Array.isArray(outgoing)
        ? outgoing.find((item) => item.addressee.id === targetUserId && item.status === 'pending')
        : undefined;
      if (outgoingRequest) {
        setRelationship({ status: 'outgoing', requestId: outgoingRequest.id });
        return;
      }

      setRelationship({ status: 'none' });
    } catch (error) {
      setRelationship({ status: 'none' });
      setFeedback(error instanceof Error ? error.message : '无法读取好友状态');
    }
  }, [currentUser?.id]);

  useEffect(() => {
    queueMicrotask(() => {
      setFeedback('');
      if (user) void loadRelationship(user.id);
    });
  }, [loadRelationship, user]);

  useEffect(() => {
    if (!menu) return;

    const close = () => onClose();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('click', close);
    window.addEventListener('scroll', close, true);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [menu, onClose]);

  const relationLabel = useMemo(() => {
    switch (relationship.status) {
      case 'friend':
        return '好友';
      case 'incoming':
        return '对方请求添加你';
      case 'outgoing':
        return '好友申请已发送';
      case 'self':
        return '这是你自己';
      case 'loading':
        return '读取关系中';
      default:
        return '未添加好友';
    }
  }, [relationship.status]);

  const runAction = async (action: () => Promise<void>, successMessage: string) => {
    setFeedback('');
    try {
      await action();
      setFeedback(successMessage);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : '操作失败');
    }
  };

  const openDirectMessage = () => {
    if (!user || !currentUser?.id || isSelf) return;
    void runAction(async () => {
      const conversation = await api.post<DirectConversation>('/api/dm/conversations', { userId: user.id });
      onClose();
      router.push(`/${currentUser.id}/dm?conversation=${conversation.id}`);
    }, '已打开私信');
  };

  const sendFriendRequest = () => {
    if (!user || isSelf) return;
    void runAction(async () => {
      await api.post<FriendRequest>('/api/friends/requests', { addresseeId: user.id });
      await loadRelationship(user.id);
    }, '好友申请已发送');
  };

  const updateFriendRequest = (requestId: number, action: 'accept' | 'reject') => {
    if (!user) return;
    void runAction(async () => {
      await api.post<FriendRequest>(`/api/friends/requests/${requestId}/${action}`, {});
      await loadRelationship(user.id);
    }, action === 'accept' ? '已接受好友申请' : '已拒绝好友申请');
  };

  const removeFriend = () => {
    if (!user) return;
    void runAction(async () => {
      await api.delete<null>(`/api/friends/${user.id}`);
      await loadRelationship(user.id);
    }, '已删除好友');
  };

  const copyUserId = () => {
    if (!user) return;
    void navigator.clipboard
      .writeText(String(user.id))
      .then(() => setFeedback('用户 ID 已复制'))
      .catch(() => setFeedback('复制失败'));
  };

  if (typeof document === 'undefined' || !menu || !user) return null;

  return createPortal(
    <>
      <div
        className="fixed z-[9999] w-60 overflow-hidden rounded-lg border border-zinc-700 bg-[#18181b] py-2 text-sm text-zinc-200 shadow-2xl"
        style={{ left: menu.x, top: menu.y }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-1 flex items-center gap-3 border-b border-zinc-700/70 px-3 pb-3 pt-1">
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-indigo-500/20 font-semibold text-white">
            {imageUrl ? <img src={imageUrl} alt={user.username} className="h-full w-full object-cover" /> : getInitial(user)}
            <span className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#18181b] ${user.isOnline ? 'bg-green-500' : 'bg-zinc-500'}`} />
          </div>
          <div className="min-w-0">
            <p className="truncate font-medium text-white">{user.username}</p>
            <p className="truncate text-xs text-zinc-500">{relationLabel}</p>
          </div>
        </div>

        <MenuButton icon={<User className="h-4 w-4" />} label="查看资料" onClick={() => setProfileUser(user)} />
        <MenuButton icon={<MessageCircle className="h-4 w-4" />} label="发送私信" onClick={openDirectMessage} disabled={isSelf} />

        {relationship.status === 'incoming' ? (
          <>
            <MenuButton icon={<Check className="h-4 w-4" />} label="接受好友申请" onClick={() => updateFriendRequest(relationship.requestId, 'accept')} />
            <MenuButton icon={<X className="h-4 w-4" />} label="拒绝好友申请" onClick={() => updateFriendRequest(relationship.requestId, 'reject')} />
          </>
        ) : relationship.status === 'friend' ? (
          <MenuButton icon={<UserMinus className="h-4 w-4" />} label="删除好友" onClick={removeFriend} danger />
        ) : relationship.status === 'outgoing' ? (
          <MenuButton icon={<UserPlus className="h-4 w-4" />} label="申请已发送" disabled />
        ) : (
          <MenuButton icon={<UserPlus className="h-4 w-4" />} label="添加好友" onClick={sendFriendRequest} disabled={isSelf || relationship.status === 'loading'} />
        )}

        <div className="my-1 border-t border-zinc-700/70" />
        <MenuButton icon={<Copy className="h-4 w-4" />} label="复制用户 ID" onClick={copyUserId} />
        <MenuButton icon={<Ban className="h-4 w-4" />} label="屏蔽用户（待接入）" disabled />

        {feedback && <div className="mx-2 mt-2 rounded bg-zinc-900 px-2 py-1.5 text-xs text-zinc-300">{feedback}</div>}
      </div>

      {profileUser && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]"
          onClick={() => setProfileUser(null)}
        >
          <div
            className="relative w-full max-w-[380px] overflow-hidden rounded-xl border border-zinc-700/80 bg-[#1b1b1d] text-zinc-100 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setProfileUser(null)}
              className="absolute right-3 top-3 z-20 rounded-full bg-black/30 p-1.5 text-zinc-300 hover:bg-black/50 hover:text-white"
              title="关闭"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="h-36 bg-[radial-gradient(circle_at_18%_10%,rgba(255,255,255,0.92),transparent_22%),linear-gradient(135deg,#f1f1ec_0%,#a9aaa6_42%,#0f0f10_100%)]" />

            <div className="relative px-6 pb-6">
              <div className="flex items-end justify-between">
                <div className="-mt-12">
                  <div className="relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-4 border-[#1b1b1d] bg-amber-100 text-3xl font-semibold text-zinc-900 shadow-xl">
                    {getAvatarUrl(profileUser) ? (
                      <img src={getAvatarUrl(profileUser)} alt={profileUser.username} className="h-full w-full object-cover" />
                    ) : (
                      getInitial(profileUser)
                    )}
                    <span className={`absolute bottom-3 right-2 h-4 w-4 rounded-full border-2 border-[#1b1b1d] ${profileUser.isOnline ? 'bg-green-500' : 'bg-zinc-500'}`} />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={openDirectMessage}
                  disabled={isSelf}
                  className="mb-2 flex items-center gap-1.5 rounded-full border border-zinc-600 bg-zinc-800/70 px-3 py-1.5 text-sm text-zinc-100 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <MessageCircle className="h-4 w-4" />
                  私信
                </button>
              </div>

              <div className="mt-4">
                <div className="flex min-w-0 items-center gap-2">
                  <h2 className="truncate text-2xl font-bold text-white">{profileUser.username}</h2>
                  {profileUser.role && (
                    <span className="rounded-full border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-xs text-zinc-400">
                      {profileUser.role}
                    </span>
                  )}
                </div>
                <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm text-zinc-300">
                  <p className="truncate">ID: {profileUser.id}</p>
                  <p className={profileUser.isOnline ? 'text-green-400' : 'text-zinc-500'}>
                    {profileUser.isOnline ? '在线' : '离线'}
                  </p>
                  {profileUser.email && <p className="col-span-2 truncate text-zinc-400">邮箱: {profileUser.email}</p>}
                </div>
              </div>

              <p className="mt-6 min-h-6 break-words text-sm leading-6 text-zinc-400">
                {profileUser.bio || '这个人很懒，什么都没写'}
              </p>

              <div className="mt-7 flex flex-wrap gap-2">
                {relationship.status === 'incoming' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => updateFriendRequest(relationship.requestId, 'accept')}
                      className="rounded-full border border-zinc-600 px-3 py-1.5 text-sm text-zinc-100 hover:bg-zinc-800"
                    >
                      接受好友申请
                    </button>
                    <button
                      type="button"
                      onClick={() => updateFriendRequest(relationship.requestId, 'reject')}
                      className="rounded-full border border-zinc-700 px-3 py-1.5 text-sm text-zinc-400 hover:bg-zinc-800"
                    >
                      拒绝
                    </button>
                  </>
                ) : relationship.status === 'friend' ? (
                  <button
                    type="button"
                    onClick={removeFriend}
                    className="rounded-full border border-zinc-600 px-3 py-1.5 text-sm text-zinc-100 hover:bg-zinc-800"
                  >
                    删除好友
                  </button>
                ) : relationship.status === 'outgoing' ? (
                  <span className="rounded-full border border-zinc-700 px-3 py-1.5 text-sm text-zinc-400">好友申请已发送</span>
                ) : relationship.status !== 'self' ? (
                  <button
                    type="button"
                    onClick={sendFriendRequest}
                    disabled={relationship.status === 'loading'}
                    className="rounded-full border border-zinc-600 px-3 py-1.5 text-sm text-zinc-100 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    + 添加好友
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={copyUserId}
                  className="rounded-full border border-zinc-700 px-3 py-1.5 text-sm text-zinc-400 hover:bg-zinc-800"
                >
                  复制 ID
                </button>
              </div>

              {feedback && <div className="mt-4 rounded-lg bg-zinc-900 px-3 py-2 text-xs text-zinc-300">{feedback}</div>}
            </div>
          </div>
        </div>
      )}
    </>,
    document.body
  );
}

function MenuButton({
  icon,
  label,
  onClick,
  disabled,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-3 px-3 py-2 text-left transition ${
        danger ? 'text-red-300 hover:bg-red-500/10' : 'text-zinc-200 hover:bg-zinc-700/70'
      } disabled:cursor-not-allowed disabled:text-zinc-600 disabled:hover:bg-transparent`}
    >
      {icon}
      <span className="truncate">{label}</span>
    </button>
  );
}
