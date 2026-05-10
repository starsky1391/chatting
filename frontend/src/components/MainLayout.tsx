"use client";
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
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
  sendChatMessage,
  sendWebSocketMessage
} from '@/lib/socket';

const MainLayout: React.FC = () => {
  const currentUser = useChatStore((state) => state.currentUser);
  const currentChannel = useChatStore((state) => state.currentChannel);
  const currentGroupId = useChatStore((state) => state.currentGroupId);
  const channels = useChatStore((state) => state.channels);
  const members = useChatStore((state) => state.members);
  const setCurrentChannel = useChatStore((state) => state.setCurrentChannel);
  const setCurrentGroupId = useChatStore((state) => state.setCurrentGroupId);
  const setMessages = useChatStore((state) => state.setMessages);
  const addMessage = useChatStore((state) => state.addMessage);
  const setGroupMembers = useChatStore((state) => state.setGroupMembers);
  const setMembers = useChatStore((state) => state.setMembers);
  const setChannels = useChatStore((state) => state.setChannels);
  const updateCurrentUser = useChatStore((state) => state.updateCurrentUser);
  const updateMemberOnlineStatus = useChatStore((state) => state.updateMemberOnlineStatus);

  const [isLoading, setIsLoading] = useState(true);
  const [wsConnected, setWsConnected] = useState(false);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

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

    connectWebSocket()
      .then(() => setWsConnected(true))
      .catch((err) => console.error('WebSocket connection failed:', err));

    return () => cleanupWebSocket();
  }, []);

  // WebSocket event handlers
  useEffect(() => {
    if (!wsConnected) return;

    const unsubMembers = onWebSocketMessage('channel:members', (data) => {
      if (data.members && Array.isArray(data.members)) {
        const formattedMembers = data.members.map((m: any) => ({
          id: m.userId || m.id,
          username: m.username || 'Unknown',
          avatar: m.avatar || '',
          avatarUrl: m.avatarUrl || '',
          isOnline: m.isOnline ?? true,
          role: 'member' as const,
          isInCall: false
        }));
        setMembers(formattedMembers);
      }
    });

    const unsubJoined = onWebSocketMessage('user:joined', (data) => {
      if (data.channelId === currentChannel?.id) {
        const newMember = {
          id: data.userId,
          username: data.username,
          avatar: '',
          avatarUrl: data.avatarUrl || '',
          isOnline: true,
          role: 'member' as const,
          isInCall: false
        };
        useChatStore.setState((state) => {
          if (state.members.some((m) => m.id === data.userId)) return state;
          return { members: [...state.members, newMember] };
        });
      }
    });

    const unsubLeft = onWebSocketMessage('user:left', (data) => {
      if (data.channelId === currentChannel?.id) {
        useChatStore.setState((state) => ({
          members: state.members.filter((m) => m.id !== data.userId)
        }));
      }
    });

    const unsubMessage = onWebSocketMessage('message:create', (data) => {
      if (data.channelId === currentChannel?.id) {
        const newMessage = {
          id: Date.now(),
          content: { type: 'text', body: data.content },
          sender: data.sender || { id: 0, username: 'Unknown' },
          createdAt: new Date(),
          isOwn: data.sender?.id === currentUser?.id
        };
        addMessage(newMessage);
      }
    });

    const unsubOnline = onWebSocketMessage('user:online', (data) => {
      if (data.userId) updateMemberOnlineStatus(data.userId, data.isOnline);
    });

    return () => {
      unsubMembers();
      unsubJoined();
      unsubLeft();
      unsubMessage();
      unsubOnline();
    };
  }, [wsConnected, currentChannel, currentUser, setMembers, addMessage, updateMemberOnlineStatus]);

  // Track previous channel
  const [prevChannelId, setPrevChannelId] = useState<number | null>(null);

  useEffect(() => {
    if (!wsConnected) return;
    if (prevChannelId !== null) leaveChannel(prevChannelId);
    if (currentChannel?.id) {
      joinChannel(currentChannel.id);
      setPrevChannelId(currentChannel.id);
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

        const response = await fetch(`${config.api.baseUrl}/api/channels/${currentChannel.id}/messages`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
          const data = await response.json();
          const messagesArray = Array.isArray(data.data) ? data.data : [];
          const messagesWithOwnership = messagesArray.map((message: any) => ({
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
          const membersData = Array.isArray(data.data) ? data.data : [];
          const formattedMembers = membersData.map((m: any) => ({
            id: m.userId || m.id,
            username: m.username || 'Unknown',
            avatar: m.avatar || '',
            avatarUrl: m.avatarUrl || '',
            isOnline: m.isOnline ?? true,
            role: 'member' as const,
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

      if (response.ok && wsConnected && isConnected()) {
        sendChatMessage(channelId, content);
      }
    } catch (error) {
      console.error('Error sending message:', error);
    }
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
              <button className="p-2 rounded-lg hover:bg-zinc-700/50 text-zinc-400 transition-all">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
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
              onBack={() => setCurrentChannel(null)}
              isLoading={isLoading}
              showHeader={false}
            />
          </main>

          {/* Layer 4: Context Sidebar - Members (240px) */}
          {currentGroupId && (
            <aside className="w-[240px] rounded-xl bg-[#1a1a2e]/80 overflow-hidden">
              <MemberList />
            </aside>
          )}
        </div>
      </div>
    </div>
  );
};

export default MainLayout;