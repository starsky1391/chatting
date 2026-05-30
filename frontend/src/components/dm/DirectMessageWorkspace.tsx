"use client";

import React, { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { Check, MessageCircle, Search, Send, UserPlus, Users, X } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import MessageBubble from '@/components/messages/MessageBubble';
import { api } from '@/lib/api';
import { config } from '@/lib/config';
import { cleanupWebSocket, connectWebSocket, onWebSocketMessage } from '@/lib/socket';
import { cn } from '@/lib/utils';
import { getStoredToken, useChatStore } from '@/store/useChatStore';

type UserResponse = {
  id: number;
  username: string;
  email: string;
  avatar: string;
  avatarUrl?: string;
  role: string;
  isOnline: boolean;
  bio?: string;
};

type Friendship = {
  id: number;
  friend: UserResponse;
  createdAt: string;
};

type FriendRequest = {
  id: number;
  requester: UserResponse;
  addressee: UserResponse;
  status: string;
  message?: string;
  createdAt: string;
};

type DirectConversation = {
  id: number;
  members: UserResponse[];
  lastMessageAt?: string;
  createdAt: string;
};

type DirectMessage = {
  id: number;
  conversationId: number;
  content: {
    type: string;
    body: string;
  };
  sender: {
    id: number;
    username: string;
    avatar: string;
    avatarUrl?: string;
  };
  createdAt: string;
};

type DirectMessageSocketPayload = {
  message?: DirectMessage;
};

type DirectMessageDeleteSocketPayload = {
  conversationId?: number;
  messageId?: number;
};

function avatarUrl(user: UserResponse) {
  return config.api.avatarThumbUrl(user.avatarUrl, 40);
}

function displayInitial(user?: UserResponse) {
  return user?.username?.charAt(0)?.toUpperCase() || 'U';
}

export default function DirectMessageWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentUser = useChatStore((state) => state.currentUser);
  const setCurrentGroupId = useChatStore((state) => state.setCurrentGroupId);
  const setCurrentChannel = useChatStore((state) => state.setCurrentChannel);
  const setActiveDirectConversationId = useChatStore((state) => state.setActiveDirectConversationId);

  const [activeTab, setActiveTab] = useState<'messages' | 'friends'>('messages');
  const [friends, setFriends] = useState<Friendship[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<FriendRequest[]>([]);
  const [conversations, setConversations] = useState<DirectConversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<DirectConversation | null>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserResponse[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [error, setError] = useState('');
  const selectedConversationIDRef = useRef<number | null>(null);

  const loadFriends = useCallback(async () => {
    const data = await api.get<Friendship[]>('/api/friends');
    setFriends(Array.isArray(data) ? data : []);
  }, []);

  const loadRequests = useCallback(async () => {
    const [incoming, outgoing] = await Promise.all([
      api.get<FriendRequest[]>('/api/friends/requests/incoming'),
      api.get<FriendRequest[]>('/api/friends/requests/outgoing'),
    ]);
    setIncomingRequests(Array.isArray(incoming) ? incoming : []);
    setOutgoingRequests(Array.isArray(outgoing) ? outgoing : []);
  }, []);

  const loadConversations = useCallback(async () => {
    const data = await api.get<DirectConversation[]>('/api/dm/conversations');
    setConversations(Array.isArray(data) ? data : []);
  }, []);

  const loadMessages = useCallback(async (conversationID: number) => {
    const data = await api.get<DirectMessage[]>(`/api/dm/conversations/${conversationID}/messages`);
    setMessages(Array.isArray(data) ? data.slice().reverse() : []);
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      setCurrentGroupId(null);
      setCurrentChannel(null);
      void Promise.all([loadFriends(), loadRequests(), loadConversations()]).catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load direct messages');
      });
    });
  }, [loadConversations, loadFriends, loadRequests, setCurrentChannel, setCurrentGroupId]);

  useEffect(() => {
    selectedConversationIDRef.current = selectedConversation?.id || null;
    setActiveDirectConversationId(selectedConversation?.id || null);
    return () => {
      selectedConversationIDRef.current = null;
      setActiveDirectConversationId(null);
    };
  }, [selectedConversation?.id, setActiveDirectConversationId]);

  useEffect(() => {
    if (!getStoredToken()) return;

    connectWebSocket().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : 'WebSocket connection failed');
    });

    const unsubscribe = onWebSocketMessage('dm:message', (rawData) => {
      const data = rawData as DirectMessageSocketPayload;
      const message = data?.message as DirectMessage | undefined;
      if (!message || message.conversationId !== selectedConversationIDRef.current) {
        void loadConversations().catch(() => {});
        return;
      }

      setMessages((items) => {
        if (items.some((item) => item.id === message.id)) return items;
        return [...items, message];
      });
      void loadConversations().catch(() => {});
    });

    const unsubscribeDelete = onWebSocketMessage('dm:message:delete', (rawData) => {
      const data = rawData as DirectMessageDeleteSocketPayload;
      if (data.conversationId !== selectedConversationIDRef.current || typeof data.messageId !== 'number') {
        void loadConversations().catch(() => {});
        return;
      }

      setMessages((items) => items.filter((item) => item.id !== data.messageId));
      void loadConversations().catch(() => {});
    });

    return () => {
      unsubscribe();
      unsubscribeDelete();
      cleanupWebSocket();
    };
  }, [loadConversations]);

  const otherMember = useCallback((conversation: DirectConversation) => {
    return conversation.members.find((member) => member.id !== currentUser?.id) || conversation.members[0];
  }, [currentUser?.id]);

  const selectedPeer = useMemo(() => {
    return selectedConversation ? otherMember(selectedConversation) : null;
  }, [otherMember, selectedConversation]);

  const selectedPeerRelation = useMemo(() => {
    if (!selectedPeer) return { status: 'none' as const };
    if (friends.some((item) => item.friend.id === selectedPeer.id)) {
      return { status: 'friend' as const };
    }

    const incoming = incomingRequests.find((item) => item.requester.id === selectedPeer.id && item.status === 'pending');
    if (incoming) return { status: 'incoming' as const, requestId: incoming.id };

    const outgoing = outgoingRequests.find((item) => item.addressee.id === selectedPeer.id && item.status === 'pending');
    if (outgoing) return { status: 'outgoing' as const, requestId: outgoing.id };

    return { status: 'none' as const };
  }, [friends, incomingRequests, outgoingRequests, selectedPeer]);

  const handleSearch = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    try {
      const data = await api.get<UserResponse[]>(`/api/friends/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchResults(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    }
  };

  const sendFriendRequest = async (user: UserResponse, options: { updateSearch?: boolean } = { updateSearch: true }) => {
    setError('');
    try {
      await api.post<FriendRequest>('/api/friends/requests', { addresseeId: user.id });
      if (options.updateSearch !== false) {
        setSearchResults((items) => items.filter((item) => item.id !== user.id));
      }
      await loadRequests();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send friend request');
    }
  };

  const updateRequest = async (requestID: number, action: 'accept' | 'reject') => {
    setError('');
    try {
      await api.post<FriendRequest>(`/api/friends/requests/${requestID}/${action}`, {});
      await Promise.all([loadFriends(), loadRequests()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update request');
    }
  };

  const openConversationWithFriend = async (friend: UserResponse) => {
    setError('');
    try {
      const conversation = await api.post<DirectConversation>('/api/dm/conversations', { userId: friend.id });
      setSelectedConversation(conversation);
      setActiveTab('messages');
      await Promise.all([loadConversations(), loadMessages(conversation.id)]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open conversation');
    }
  };

  const selectConversation = useCallback(async (conversation: DirectConversation) => {
    setSelectedConversation(conversation);
    await loadMessages(conversation.id).catch((err: unknown) => {
      setError(err instanceof Error ? err.message : 'Failed to load messages');
    });
  }, [loadMessages]);

  useEffect(() => {
    const conversationID = Number(searchParams.get('conversation') || 0);
    if (!conversationID || selectedConversation?.id === conversationID) return;

    const conversation = conversations.find((item) => item.id === conversationID);
    if (conversation) {
      queueMicrotask(() => {
        void selectConversation(conversation);
      });
    }
  }, [conversations, searchParams, selectedConversation?.id, selectConversation]);

  const sendMessage = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedConversation || !messageInput.trim()) return;

    const content = messageInput.trim();
    setMessageInput('');
    try {
      const message = await api.post<DirectMessage>(`/api/dm/conversations/${selectedConversation.id}/messages`, { content });
      setMessages((items) => {
        if (items.some((item) => item.id === message.id)) return items;
        return [...items, message];
      });
      await loadConversations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
      setMessageInput(content);
    }
  };

  const recallMessage = async (messageID: number) => {
    if (!selectedConversation) return;

    await api.delete<null>(`/api/dm/conversations/${selectedConversation.id}/messages/${messageID}`);
    setMessages((items) => items.filter((item) => item.id !== messageID));
    await loadConversations();
  };

  const mappedMessages = messages.map((message) => ({
    id: message.id,
    content: message.content,
    sender: message.sender,
    createdAt: message.createdAt,
    isOwn: message.sender.id === currentUser?.id,
  }));

  return (
    <div className="flex h-screen bg-[#0f0f12] text-zinc-100">
      <aside className="flex w-[72px] flex-col items-center gap-3 border-r border-zinc-800 bg-[#111113] py-4">
        <button
          onClick={() => currentUser?.id && router.push(`/${currentUser.id}`)}
          className="flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
          title="Servers"
        >
          #
        </button>
        <button
          className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-500 text-white"
          title="Direct Messages"
        >
          <MessageCircle className="h-5 w-5" />
        </button>
      </aside>

      <aside className="flex w-[320px] flex-col border-r border-zinc-800 bg-[#151517]">
        <div className="border-b border-zinc-800 px-5 py-4">
          <div className="mb-4 flex items-center gap-5 text-xl font-semibold">
            <button
              onClick={() => setActiveTab('messages')}
              className={cn(activeTab === 'messages' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300')}
            >
              私信
            </button>
            <button
              onClick={() => setActiveTab('friends')}
              className={cn(activeTab === 'friends' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300')}
            >
              好友
            </button>
          </div>
          <form onSubmit={handleSearch} className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2">
            <Search className="h-4 w-4 text-zinc-500" />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="搜索用户名或邮箱"
              className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-zinc-500"
            />
          </form>
        </div>

        {error && (
          <div className="mx-4 mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        {searchResults.length > 0 && (
          <section className="border-b border-zinc-800 p-4">
            <p className="mb-2 text-xs font-medium uppercase text-zinc-500">搜索结果</p>
            <div className="space-y-2">
              {searchResults.map((user) => (
                <UserRow
                  key={user.id}
                  user={user}
                  actionLabel="添加"
                  actionIcon={<UserPlus className="h-4 w-4" />}
                  onAction={() => sendFriendRequest(user)}
                />
              ))}
            </div>
          </section>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {activeTab === 'messages' ? (
            <div className="space-y-2">
              {conversations.length === 0 ? (
                <EmptyList label="暂无私信会话" />
              ) : (
                conversations.map((conversation) => {
                  const peer = otherMember(conversation);
                  return (
                    <button
                      key={conversation.id}
                      onClick={() => selectConversation(conversation)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-zinc-800",
                        selectedConversation?.id === conversation.id && "bg-zinc-800"
                      )}
                    >
                      <Avatar user={peer} />
                      <div className="min-w-0">
                        <div className="flex min-w-0 items-center gap-2">
                          <p className="truncate text-sm font-medium text-white">{peer?.username || 'Unknown'}</p>
                          {peer && !friends.some((item) => item.friend.id === peer.id) && (
                            <span className="shrink-0 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-300">非好友</span>
                          )}
                        </div>
                        <p className="truncate text-xs text-zinc-500">点击继续聊天</p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          ) : (
            <div className="space-y-5">
              <section>
                <p className="mb-2 text-xs font-medium uppercase text-zinc-500">好友</p>
                <div className="space-y-2">
                  {friends.length === 0 ? (
                    <EmptyList label="还没有好友" />
                  ) : (
                    friends.map((friendship) => (
                      <UserRow
                        key={friendship.id}
                        user={friendship.friend}
                        actionLabel="私信"
                        actionIcon={<MessageCircle className="h-4 w-4" />}
                        onAction={() => openConversationWithFriend(friendship.friend)}
                      />
                    ))
                  )}
                </div>
              </section>

              {incomingRequests.length > 0 && (
                <section>
                  <p className="mb-2 text-xs font-medium uppercase text-zinc-500">待处理申请</p>
                  <div className="space-y-2">
                    {incomingRequests.map((requestItem) => (
                      <UserRow
                        key={requestItem.id}
                        user={requestItem.requester}
                        actionLabel="接受"
                        actionIcon={<Check className="h-4 w-4" />}
                        secondaryActionIcon={<X className="h-4 w-4" />}
                        onAction={() => updateRequest(requestItem.id, 'accept')}
                        onSecondaryAction={() => updateRequest(requestItem.id, 'reject')}
                      />
                    ))}
                  </div>
                </section>
              )}

              {outgoingRequests.length > 0 && (
                <section>
                  <p className="mb-2 text-xs font-medium uppercase text-zinc-500">已发送申请</p>
                  <div className="space-y-2">
                    {outgoingRequests.map((requestItem) => (
                      <UserRow key={requestItem.id} user={requestItem.addressee} actionLabel="等待中" />
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col bg-[#0f0f12]">
        {selectedConversation && selectedPeer ? (
          <>
            <header className="flex h-16 items-center gap-3 border-b border-zinc-800 px-6">
              <Avatar user={selectedPeer} />
              <div>
                <h1 className="text-base font-semibold text-white">{selectedPeer.username}</h1>
                <p className="text-xs text-zinc-500">{selectedPeer.isOnline ? '在线' : '离线'}</p>
              </div>
            </header>

            {selectedPeerRelation.status !== 'friend' && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-500/20 bg-amber-500/10 px-6 py-3 text-sm text-amber-100">
                {selectedPeerRelation.status === 'incoming' ? (
                  <>
                    <p>对方请求添加你为好友。你们现在也可以继续私信。</p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => updateRequest(selectedPeerRelation.requestId, 'accept')}
                        className="rounded-md bg-amber-400 px-3 py-1.5 text-xs font-medium text-zinc-950 hover:bg-amber-300"
                      >
                        接受
                      </button>
                      <button
                        type="button"
                        onClick={() => updateRequest(selectedPeerRelation.requestId, 'reject')}
                        className="rounded-md border border-amber-400/40 px-3 py-1.5 text-xs font-medium text-amber-100 hover:bg-amber-400/10"
                      >
                        拒绝
                      </button>
                    </div>
                  </>
                ) : selectedPeerRelation.status === 'outgoing' ? (
                  <p>你们还不是好友，好友申请已发送。你们现在也可以继续私信。</p>
                ) : (
                  <>
                    <p>你们还不是好友。添加好友后更容易找到彼此。</p>
                    <button
                      type="button"
                      onClick={() => sendFriendRequest(selectedPeer, { updateSearch: false })}
                      className="rounded-md bg-amber-400 px-3 py-1.5 text-xs font-medium text-zinc-950 hover:bg-amber-300"
                    >
                      添加好友
                    </button>
                  </>
                )}
              </div>
            )}

            <div className="min-h-0 flex-1 overflow-y-auto p-6">
              {mappedMessages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-zinc-500">
                  <MessageCircle className="mb-4 h-16 w-16 opacity-50" />
                  <p>还没有消息，开始聊天吧。</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {mappedMessages.map((message) => (
                    <MessageBubble key={message.id} message={message} onRecall={recallMessage} />
                  ))}
                </div>
              )}
            </div>

            <form onSubmit={sendMessage} className="border-t border-zinc-800 p-4">
              <div className="flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2">
                <input
                  value={messageInput}
                  onChange={(event) => setMessageInput(event.target.value)}
                  placeholder={`给 ${selectedPeer.username} 发消息`}
                  className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-zinc-500"
                />
                <button
                  type="submit"
                  disabled={!messageInput.trim()}
                  className="rounded-lg bg-indigo-500 p-2 text-white disabled:opacity-40"
                  title="发送"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-center text-zinc-500">
            <Users className="mb-5 h-24 w-24 opacity-40" />
            <h1 className="mb-2 text-xl font-semibold text-zinc-300">当前没有打开的私信</h1>
            <p className="max-w-sm text-sm">在左侧选择好友或搜索用户添加好友后开始聊天。</p>
          </div>
        )}
      </main>
    </div>
  );
}

function Avatar({ user }: { user?: UserResponse }) {
  const imageUrl = user ? avatarUrl(user) : '';
  return (
    <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-700 text-sm font-semibold text-white">
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt={user?.username || 'Avatar'}
          fill
          sizes="40px"
          className="object-cover"
          unoptimized
        />
      ) : (
        displayInitial(user)
      )}
      {user?.isOnline && <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#151517] bg-green-500" />}
    </div>
  );
}

function UserRow({
  user,
  actionLabel,
  actionIcon,
  secondaryActionIcon,
  onAction,
  onSecondaryAction,
}: {
  user: UserResponse;
  actionLabel: string;
  actionIcon?: React.ReactNode;
  secondaryActionIcon?: React.ReactNode;
  onAction?: () => void;
  onSecondaryAction?: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-zinc-800">
      <Avatar user={user} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-white">{user.username}</p>
        <p className="truncate text-xs text-zinc-500">{user.email}</p>
      </div>
      {onSecondaryAction && (
        <button
          onClick={onSecondaryAction}
          className="rounded-lg bg-zinc-800 p-2 text-zinc-300 hover:bg-red-500/20 hover:text-red-300"
          title="拒绝"
        >
          {secondaryActionIcon}
        </button>
      )}
      {onAction ? (
        <button
          onClick={onAction}
          className="flex items-center gap-1 rounded-lg bg-indigo-500/20 px-2.5 py-2 text-xs text-indigo-300 hover:bg-indigo-500/30"
          title={actionLabel}
        >
          {actionIcon}
          <span>{actionLabel}</span>
        </button>
      ) : (
        <span className="rounded-lg bg-zinc-800 px-2.5 py-2 text-xs text-zinc-500">{actionLabel}</span>
      )}
    </div>
  );
}

function EmptyList({ label }: { label: string }) {
  return <div className="rounded-lg border border-dashed border-zinc-800 px-3 py-6 text-center text-sm text-zinc-500">{label}</div>;
}
