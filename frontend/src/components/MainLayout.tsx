"use client";
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useChatStore } from '@/store/useChatStore';
import MessageArea from './messages/MessageArea';
import ChannelList from './sidebar/ChannelList';
import MemberList from './members/MemberList';
import ServerList from './sidebar/ServerList';
import { config } from '@/lib/config';
import { api } from '../lib/api';
import {
  connectWebSocket,
  joinChannel,
  leaveChannel,
  onWebSocketMessage,
  cleanupWebSocket,
  isConnected,
  sendWebSocketMessage,
  onConnect,
  onDisconnect
} from '@/lib/socket';
import { Search, Users } from 'lucide-react';

const MainLayout: React.FC = () => {
  const currentUser = useChatStore((state) => state.currentUser);
  const currentChannel = useChatStore((state) => state.currentChannel);
  const currentGroupId = useChatStore((state) => state.currentGroupId);
  const members = useChatStore((state) => state.members);
  const isMemberSidebarOpen = useChatStore((state) => state.isMemberSidebarOpen);
  const toggleMemberSidebar = useChatStore((state) => state.toggleMemberSidebar);
  const setCurrentChannel = useChatStore((state) => state.setCurrentChannel);
  const setMessages = useChatStore((state) => state.setMessages);
  const addMessage = useChatStore((state) => state.addMessage);
  const removeMessage = useChatStore((state) => state.removeMessage);
  const setGroupMembers = useChatStore((state) => state.setGroupMembers);
  const setMembers = useChatStore((state) => state.setMembers);
  const setChannels = useChatStore((state) => state.setChannels);
  const updateCurrentUser = useChatStore((state) => state.updateCurrentUser);
  const updateMemberOnlineStatus = useChatStore((state) => state.updateMemberOnlineStatus);

  const [isLoading, setIsLoading] = useState(true);
  const [wsConnected, setWsConnected] = useState(false);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

  type SocketUserPayload = {
    userId?: number;
    id?: number;
    username?: string;
    avatar?: string;
    avatarUrl?: string;
    isOnline?: boolean;
    groupRole?: string;
  };

  type ChannelMembersPayload = {
    channelId?: number;
    members?: SocketUserPayload[];
  };

  type ChannelEventPayload = SocketUserPayload & {
    channelId?: number;
  };

  type MessagePayload = {
    channelId?: number;
    id?: number;
    content?: string | { type: string; body: string };
    sender?: {
      id?: number;
      username?: string;
      avatar?: string;
      avatarUrl?: string;
    };
    createdAt?: string | Date;
    message?: {
      id: number;
      content: { type: string; body: string };
      sender: {
        id?: number;
        username?: string;
        avatar?: string;
        avatarUrl?: string;
      };
      createdAt: string | Date;
    };
  };

  type MessageDeletePayload = {
    channelId?: number;
    messageId?: number;
  };

  type ApiMessage = {
    id: number;
    content: { type: string; body: string };
    sender?: {
      id?: number;
      username?: string;
      avatar?: string;
      avatarUrl?: string;
    };
    createdAt: string | Date;
  };

  type ApiEnvelope<T> = {
    data?: T;
    error?: string;
    message?: string;
  };

  // Fetch current user info on mount
  const fetchCurrentUser = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch(`${config.api.baseUrl}/api/user`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        const user = data.data || data;
        updateCurrentUser({
          username: user.username,
          avatar: user.avatar,
          avatarUrl: user.avatarUrl,
          isOnline: user.isOnline,
          bio: user.bio
        });
        localStorage.setItem('user', JSON.stringify(user));
      }
    } catch (error) {
      console.error('Failed to fetch user info:', error);
    }
  }, [updateCurrentUser]);

  useEffect(() => {
    fetchCurrentUser();
  }, [fetchCurrentUser]);

  // Handle page close - notify backend that user is leaving
  useEffect(() => {
    const handleBeforeUnload = () => {
      // The backend will mark user offline after 30 seconds of no heartbeat
      // This is handled by the SyncOnlineStatus background task
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  // Heartbeat mechanism
  const sendHeartbeat = useCallback(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    // HTTP heartbeat to update database and Redis
    fetch(`${config.api.baseUrl}/api/user/heartbeat`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => {
        if (!res.ok) {
          console.warn('Heartbeat failed:', res.status);
        }
      })
      .catch(err => console.warn('Heartbeat error:', err));

    // WebSocket heartbeat
    if (isConnected()) {
      sendWebSocketMessage('heartbeat', {});
    }
  }, []);

  useEffect(() => {
    sendHeartbeat();
    heartbeatIntervalRef.current = setInterval(sendHeartbeat, 25000);
    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
    };
  }, [sendHeartbeat]);

  // Initialize WebSocket
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const unsubscribeConnect = onConnect(() => setWsConnected(true));
    const unsubscribeDisconnect = onDisconnect(() => setWsConnected(false));

    connectWebSocket()
      .then(() => setWsConnected(true))
      .catch((err) => console.error('WebSocket connection failed:', err));

    return () => {
      unsubscribeConnect();
      unsubscribeDisconnect();
      cleanupWebSocket();
    };
  }, []);

  // WebSocket event handlers
  useEffect(() => {
    if (!wsConnected) return;

    const unsubMembers = onWebSocketMessage('channel:members', (rawData) => {
      const data = rawData as ChannelMembersPayload;
      if (data.channelId !== currentChannel?.id) return;
      if (data.members && Array.isArray(data.members)) {
        const formattedMembers = data.members.map((m) => ({
          id: m.userId ?? m.id ?? 0,
          username: m.username || 'Unknown',
          avatar: m.avatar || '',
          avatarUrl: m.avatarUrl || '',
          isOnline: m.isOnline ?? true,
          role: 'member' as const,
          groupRole: m.groupRole,
          isInCall: false
        }));
        setMembers(formattedMembers);
      }
    });

    const unsubJoined = onWebSocketMessage('user:joined', (rawData) => {
      const data = rawData as ChannelEventPayload;
      if (data.channelId === currentChannel?.id) {
        if (!data.userId) return;
        const newMember = {
          id: data.userId,
          username: data.username || 'Unknown',
          avatar: '',
          avatarUrl: data.avatarUrl || '',
          isOnline: true,
          role: 'member' as const,
          groupRole: data.groupRole,
          isInCall: false
        };
        useChatStore.setState((state) => {
          if (state.members.some((m) => m.id === data.userId)) return state;
          return { members: [...state.members, newMember] };
        });
      }
    });

    const unsubLeft = onWebSocketMessage('user:left', (rawData) => {
      const data = rawData as ChannelEventPayload;
      if (data.channelId === currentChannel?.id) {
        useChatStore.setState((state) => ({
          members: state.members.filter((m) => m.id !== data.userId)
        }));
      }
    });

    const unsubMessage = onWebSocketMessage('message:create', (rawData) => {
      const data = rawData as MessagePayload;
      if (data.channelId === currentChannel?.id) {
        const message = data.message || {
          id: data.id || Date.now(),
          content: typeof data.content === 'string' ? { type: 'text', body: data.content } : data.content || { type: 'text', body: '' },
          sender: data.sender || { id: 0, username: 'Unknown' },
          createdAt: data.createdAt || new Date(),
        };
        const newMessage = {
          ...message,
          sender: {
            id: message.sender?.id || 0,
            username: message.sender?.username || 'Unknown',
            avatar: message.sender?.avatar || '',
            avatarUrl: message.sender?.avatarUrl || '',
            email: '',
            isOnline: true,
            role: 'member' as const,
          },
          isOwn: message.sender?.id === currentUser?.id
        };
        addMessage(newMessage);
      }
    });

    const unsubMessageDelete = onWebSocketMessage('message:delete', (rawData) => {
      const data = rawData as MessageDeletePayload;
      if (data.channelId !== currentChannel?.id || typeof data.messageId !== 'number') return;
      removeMessage(data.messageId);
    });

    const unsubOnline = onWebSocketMessage('user:online', (rawData) => {
      const data = rawData as ChannelEventPayload;
      if (data.userId) updateMemberOnlineStatus(data.userId, data.isOnline ?? false);
    });

    return () => {
      unsubMembers();
      unsubJoined();
      unsubLeft();
      unsubMessage();
      unsubMessageDelete();
      unsubOnline();
    };
  }, [wsConnected, currentChannel, currentUser, setMembers, addMessage, removeMessage, updateMemberOnlineStatus]);

  // Track previous channel
  const prevChannelIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!wsConnected) return;
    if (prevChannelIdRef.current !== null) leaveChannel(prevChannelIdRef.current);
    if (currentChannel?.id) {
      joinChannel(currentChannel.id);
      prevChannelIdRef.current = currentChannel.id;
    }
    return () => {
      if (currentChannel?.id) leaveChannel(currentChannel.id);
    };
  }, [wsConnected, currentChannel?.id]);

  // Fetch messages
  useEffect(() => {
    if (!currentChannel) return;
    const fetchMessages = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) { setMessages([]); return; }

        const params = new URLSearchParams({ limit: '50', offset: '0' });
        const response = await fetch(`${config.api.baseUrl}/api/channels/${currentChannel.id}/messages?${params.toString()}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
          const data = await response.json();
          const messagesArray = Array.isArray(data.data) ? data.data : [];
          const messagesWithOwnership = messagesArray.map((message: ApiMessage) => ({
            ...message,
            isOwn: message.sender?.id === (currentUser?.id || 0)
          }));
          setMessages(messagesWithOwnership);
        } else {
          setMessages([]);
        }
      } catch {
        setMessages([]);
      }
    };
    fetchMessages();
  }, [currentChannel, setMessages, currentUser]);

  // Fetch channel members
  useEffect(() => {
    if (!currentChannel?.id) { setMembers([]); return; }
    const fetchChannelMembers = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;

        const response = await fetch(`${config.api.baseUrl}/api/channels/${currentChannel.id}/active-members`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
          const data = await response.json();
          const membersData = Array.isArray(data.data) ? data.data as SocketUserPayload[] : [];
          const formattedMembers = membersData.map((m) => ({
            id: m.userId ?? m.id ?? 0,
            username: m.username || 'Unknown',
            avatar: m.avatar || '',
            avatarUrl: m.avatarUrl || '',
            isOnline: m.isOnline ?? true,
            role: 'member' as const,
            groupRole: m.groupRole,
            isInCall: false
          }));
          setMembers(formattedMembers);
        }
      } catch (error) {
        console.error('Failed to fetch channel members:', error);
      }
    };
    fetchChannelMembers();
    const interval = setInterval(fetchChannelMembers, 30000);
    return () => clearInterval(interval);
  }, [currentChannel, setMembers]);

  // Fetch group members
  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) { setGroupMembers([]); return; }

        if (currentGroupId) {
          const response = await fetch(`${config.api.baseUrl}/api/groups/${currentGroupId}/members`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (response.ok) {
            const data = await response.json();
            setGroupMembers(Array.isArray(data.data) ? data.data : []);
          } else {
            setGroupMembers([]);
          }
        } else {
          setGroupMembers([]);
        }
      } catch {
        setGroupMembers([]);
      }
    };
    fetchMembers();

    // Poll for member updates every 15 seconds to refresh online status
    const interval = setInterval(fetchMembers, 15000);
    return () => clearInterval(interval);
  }, [currentGroupId, setGroupMembers]);

  // Fetch channels
  useEffect(() => {
    const fetchChannels = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) { setChannels([]); return; }

        const data = await api.get('/api/channels');
        setChannels(Array.isArray(data) ? data : []);
        setIsLoading(false);
      } catch {
        setChannels([]);
        setIsLoading(false);
      }
    };
    fetchChannels();
  }, [setChannels]);

  // Send message
  const handleSendMessage = async (content: string) => {
    try {
      if (!currentChannel) return;
      const channelId = Number(currentChannel.id);
      if (!channelId || isNaN(channelId)) return;

      const response = await fetch(`${config.api.baseUrl}/api/channels/${channelId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ content })
      });

      if (!response.ok) throw new Error(`Failed to send message: ${response.status}`);
      const payload = (await response.json()) as ApiEnvelope<ApiMessage>;
      if (payload.data) {
        addMessage({
          ...payload.data,
          sender: {
            id: payload.data.sender?.id || currentUser?.id || 0,
            username: payload.data.sender?.username || currentUser?.username || 'Unknown',
            avatar: payload.data.sender?.avatar || currentUser?.avatar || '',
            avatarUrl: payload.data.sender?.avatarUrl || currentUser?.avatarUrl || '',
            email: currentUser?.email || '',
            isOnline: true,
            role: (currentUser?.role || 'member') as 'admin' | 'moderator' | 'member',
          },
          isOwn: true,
        });
      }
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleRecallMessage = async (messageId: number) => {
    if (!currentChannel) return;
    const channelId = Number(currentChannel.id);
    if (!channelId || isNaN(channelId)) return;

    const response = await fetch(`${config.api.baseUrl}/api/channels/${channelId}/messages/${messageId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.message || payload.error || '撤回消息失败');
    }

    removeMessage(messageId);
  };

  // Get channel header title
  const getHeaderTitle = () => {
    if (currentChannel) {
      const icon = currentChannel.type === 'voice' ? '🔊' : '#';
      return `${icon} ${currentChannel.name}`;
    }
    return 'Select a channel';
  };

  return (
    <div className="flex h-screen bg-[#0f0f12] p-2 gap-2">
      {/* Layer 1: Gutter - Server/Group icons (64px) */}
      <aside className="w-[68px] flex flex-col gap-2">
        <ServerList isLoading={isLoading} />
      </aside>

      {/* Layer 2: Navigation - Channel list (240px) */}
      <aside className="w-[240px] rounded-xl bg-[#1a1a2e]/80 overflow-hidden">
        <ChannelList isLoading={isLoading} />
      </aside>

      {/* Layer 3: Main Stage + Layer 4: Context Sidebar */}
      <div className="flex-1 flex flex-col gap-2">
        {/* Shared Header spanning Main + Context */}
        <header className="h-[48px] flex items-center justify-between px-4 rounded-xl bg-[#1a1a2e]/80 border-b border-zinc-700/50">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-white">{getHeaderTitle()}</h2>
            {currentChannel?.type === 'voice' && (
              <span className="text-xs text-zinc-400">
                {members.filter(m => m.isInCall).length} in call
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {currentChannel && (
              <button className="p-2 rounded-lg hover:bg-zinc-700/50 text-zinc-400 transition-all" title="搜索">
                <Search className="h-5 w-5" />
              </button>
            )}
            {currentGroupId && (
              <button
                type="button"
                onClick={toggleMemberSidebar}
                className={`p-2 rounded-lg transition-all ${
                  isMemberSidebarOpen
                    ? 'bg-zinc-700/40 text-white'
                    : 'text-zinc-400 hover:bg-zinc-700/50 hover:text-white'
                }`}
                title={isMemberSidebarOpen ? '折叠成员列表' : '展开成员列表'}
              >
                <Users className="h-5 w-5" />
              </button>
            )}
          </div>
        </header>

        {/* Main Content Area */}
        <div className="flex-1 flex gap-2 min-h-0">
          {/* Main Stage - Messages/Voice */}
          <main className="flex-1 rounded-xl bg-[#1a1a2e]/80 overflow-hidden flex flex-col">
            <MessageArea
              currentChannel={currentChannel}
              onSendMessage={handleSendMessage}
              onRecallMessage={handleRecallMessage}
              onBack={() => setCurrentChannel(null)}
              isLoading={isLoading}
              showHeader={false}
            />
          </main>

          {/* Layer 4: Context Sidebar - Members (240px) */}
          {currentGroupId && (
            <aside
              className={`rounded-xl bg-[#1a1a2e]/80 overflow-hidden transition-all duration-200 ${
                isMemberSidebarOpen ? 'w-[240px]' : 'w-[56px]'
              }`}
            >
              <MemberList />
            </aside>
          )}
        </div>
      </div>
    </div>
  );
};

export default MainLayout;
