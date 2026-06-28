import { create } from 'zustand';

// 定义类型
export interface User {
  id: number;
  username: string;
  avatar: string;
  avatarUrl?: string;
  email: string;
  isOnline: boolean;
  role: 'admin' | 'moderator' | 'member';
  bio?: string;
  groupRole?: string;
}

export interface Channel {
  id: number;
  name: string;
  type: 'text' | 'voice';
  groupId?: number;
  maxMembers?: number;
  isInCall?: boolean;
  callMembers?: number;
}

export interface Message {
  id: number;
  content: {
    type: string;
    body: string;
  };
  sender: User;
  createdAt: Date | string;
  isOwn: boolean;
}

export interface Member {
  id: number;
  username: string;
  avatar: string;
  avatarUrl?: string;
  isOnline: boolean;
  role: 'admin' | 'moderator' | 'member';
  groupRole?: string;
  isInCall?: boolean;
}

export interface VoiceParticipant {
  identity: string;
  name: string;
  avatarUrl?: string;
  isSpeaking: boolean;
  isMuted: boolean;
}

export type VoiceNoiseMode = 'browser_processing' | 'custom_denoise';

export interface ChatState {
  // 用户信息
  currentUser: User | null;
  isAuthenticated: boolean;
  hydrateAuthFromStorage: () => void;
  login: (user: User, token: string) => void;
  logout: () => void;
  updateCurrentUser: (user: Partial<User>) => void;

  // 频道相关
  channels: Channel[];
  currentChannel: Channel | null;
  currentGroupId: number | null;
  setCurrentChannel: (channel: Channel | null) => void;
  setCurrentGroupId: (groupId: number | null) => void;
  setChannels: (channels: Channel[]) => void;
  addChannel: (channel: Channel) => void;
  removeChannel: (channelId: number) => void;
  leaveChannel: (channelId: number) => void;
  joinChannel: (channel: Channel) => void;
  updateChannelCallStatus: (channelId: number, isInCall: boolean, callMembers: number) => void;

  // 消息相关
  messages: Message[];
  addMessage: (message: Message) => void;
  setMessages: (messages: Message[]) => void;
  removeMessage: (messageId: number) => void;
  
  // 成员相关
  members: Member[];
  groupMembers: Member[];
  setMembers: (members: Member[]) => void;
  setGroupMembers: (members: Member[]) => void;
  updateMemberOnlineStatus: (memberId: number, isOnline: boolean) => void;
  updateMemberCallStatus: (memberId: number, isInCall: boolean) => void;
  
  // 语音通话相关
  isInCall: boolean;
  isJoiningCall: boolean;
  localStream: MediaStream | null;
  remoteStreams: Map<number, MediaStream>;
  activeVoiceChannel: Channel | null;
  voiceParticipants: VoiceParticipant[];
  voiceIsMuted: boolean;
  voiceIsDeafened: boolean;
  voiceInputVolume: number;
  voiceOutputVolume: number;
  voiceNoiseMode: VoiceNoiseMode;
  voiceError: string | null;
  voiceJoinRequest: { channel: Channel; nonce: number } | null;
  joinCall: () => void;
  leaveCall: () => void;
  toggleMute: () => void;
  setLocalStream: (stream: MediaStream | null) => void;
  addRemoteStream: (userId: number, stream: MediaStream) => void;
  removeRemoteStream: (userId: number) => void;
  setActiveVoiceChannel: (channel: Channel | null) => void;
  setVoiceParticipants: (participants: VoiceParticipant[]) => void;
  setVoiceMuted: (isMuted: boolean) => void;
  setVoiceDeafened: (isDeafened: boolean) => void;
  setVoiceInputVolume: (volume: number) => void;
  setVoiceOutputVolume: (volume: number) => void;
  setVoiceNoiseMode: (mode: VoiceNoiseMode) => void;
  setVoiceError: (error: string | null) => void;
  requestJoinVoiceChannel: (channel: Channel) => void;

  // 屏幕共享相关
  isScreenSharing: boolean;
  screenShareParticipant: string | null;
  isScreenShareExpanded: boolean;
  screenShareTrack: MediaStreamTrack | null;
  setScreenSharing: (isSharing: boolean) => void;
  setScreenShareParticipant: (participant: string | null) => void;
  setScreenShareExpanded: (isExpanded: boolean) => void;
  setScreenShareTrack: (track: MediaStreamTrack | null) => void;

  // 私信相关
  activeDirectConversationId: number | null;
  setActiveDirectConversationId: (conversationId: number | null) => void;
  
  // 侧边栏状态
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
  isMemberSidebarOpen: boolean;
  toggleMemberSidebar: () => void;
}

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

export function getStoredUser(): User | null {
  if (typeof window === 'undefined') return null;

  const savedUser = localStorage.getItem('user');
  if (!savedUser) return null;

  try {
    return JSON.parse(savedUser) as User;
  } catch {
    localStorage.removeItem('user');
    return null;
  }
}

export function saveStoredAuth(user: User, token?: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('user', JSON.stringify(user));
  if (token) {
    localStorage.setItem('token', token);
  }
}

export function clearStoredAuth(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('user');
  localStorage.removeItem('token');
}

export function getStoredVoiceNoiseMode(): VoiceNoiseMode {
  if (typeof window === 'undefined') return 'browser_processing';
  const storedMode = localStorage.getItem('voiceNoiseMode');
  if (storedMode === 'browser_processing' || storedMode === 'custom_denoise') {
    return storedMode;
  }
  if (storedMode === 'none' || storedMode === 'noise_suppression') {
    return 'browser_processing';
  }
  return 'browser_processing';
}

export function saveStoredVoiceNoiseMode(mode: VoiceNoiseMode): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('voiceNoiseMode', mode);
}

export const chatStoreSelectors = {
  currentUser: (state: ChatState) => state.currentUser,
  isAuthenticated: (state: ChatState) => state.isAuthenticated,
  hydrateAuthFromStorage: (state: ChatState) => state.hydrateAuthFromStorage,
  currentChannel: (state: ChatState) => state.currentChannel,
  currentGroupId: (state: ChatState) => state.currentGroupId,
  channels: (state: ChatState) => state.channels,
  messages: (state: ChatState) => state.messages,
  members: (state: ChatState) => state.members,
  groupMembers: (state: ChatState) => state.groupMembers,
  isInCall: (state: ChatState) => state.isInCall,
  isMemberSidebarOpen: (state: ChatState) => state.isMemberSidebarOpen,
  login: (state: ChatState) => state.login,
  logout: (state: ChatState) => state.logout,
  updateCurrentUser: (state: ChatState) => state.updateCurrentUser,
  setCurrentChannel: (state: ChatState) => state.setCurrentChannel,
  setCurrentGroupId: (state: ChatState) => state.setCurrentGroupId,
  toggleMemberSidebar: (state: ChatState) => state.toggleMemberSidebar,
};

// 创建 store
export const useChatStore = create<ChatState>((set) => {
  return {
    // 用户信息
    currentUser: null,
    isAuthenticated: false,

    hydrateAuthFromStorage: () => {
      const storedUser = getStoredUser();
      set({
        currentUser: storedUser,
        isAuthenticated: !!storedUser,
      });
    },
    
    login: (user, token) => {
      saveStoredAuth(user, token);
      
      // 更新状态
      set({
        currentUser: user,
        isAuthenticated: true,
      });
    },
    
    logout: () => {
      clearStoredAuth();
      
      // 更新状态
      set({
        currentUser: null,
        isAuthenticated: false,
        channels: [],
        currentChannel: null,
        messages: [],
        members: [],
        isInCall: false,
        isJoiningCall: false,
        localStream: null,
        remoteStreams: new Map(),
        activeVoiceChannel: null,
        voiceParticipants: [],
        voiceIsMuted: false,
        voiceIsDeafened: false,
        voiceError: null,
        voiceJoinRequest: null,
        activeDirectConversationId: null
      });
    },
    
    updateCurrentUser: (user) => set((state) => {
      const updatedUser = state.currentUser ? { ...state.currentUser, ...user } : null;
      if (updatedUser) {
        saveStoredAuth(updatedUser);
      }
      return { currentUser: updatedUser };
    }),
    
    // 频道相关
    channels: [],
    currentChannel: null,
    currentGroupId: null,
    setCurrentChannel: (channel) => set({ currentChannel: channel }),
    setCurrentGroupId: (groupId) => set({ currentGroupId: groupId }),
    setChannels: (channels) => set({ channels: Array.isArray(channels) ? channels : [] }),
    
    // 新增频道管理方法
    addChannel: (channel) => set((state) => ({
      channels: [...state.channels, channel]
    })),
    
    removeChannel: (channelId) => set((state) => ({
      channels: state.channels.filter(channel => channel.id !== channelId),
      // 如果移除的是当前频道，清空currentChannel
      currentChannel: state.currentChannel?.id === channelId ? null : state.currentChannel
    })),
    
    joinChannel: (channel) => set((state) => ({
      channels: [...state.channels, channel]
    })),
    
    leaveChannel: (channelId) => set((state) => ({
      channels: state.channels.filter(channel => channel.id !== channelId),
      // 如果离开的是当前频道，清空currentChannel
      currentChannel: state.currentChannel?.id === channelId ? null : state.currentChannel
    })),
    
    // 更新频道通话状态
    updateChannelCallStatus: (channelId, isInCall, callMembers) => set((state) => ({
      channels: state.channels.map(channel => 
        channel.id === channelId 
          ? { ...channel, isInCall, callMembers } 
          : channel
      )
    })),
    
    // 消息相关
    messages: [],
    addMessage: (message) => set((state) => {
      // 确保state.messages是数组
      const currentMessages = Array.isArray(state.messages) ? state.messages : [];
      if (currentMessages.some((item) => item.id === message.id)) {
        return {};
      }
      // 创建新消息数组，包含现有消息和新消息
      const newMessages = [...currentMessages, message];
      // 按createdAt正序排序
      newMessages.sort((a, b) => {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return dateA - dateB;
      });
      return { messages: newMessages };
    }),
    setMessages: (messages) => set(() => {
      // 确保只设置数组到messages
      const validMessages = Array.isArray(messages) ? [...messages] : [];
      // 按createdAt正序排序
      validMessages.sort((a, b) => {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return dateA - dateB;
      });
      return { messages: validMessages };
    }),
    removeMessage: (messageId) => set((state) => ({
      messages: state.messages.filter((message) => message.id !== messageId),
    })),
    
    // 成员相关
    members: [],
    groupMembers: [],
    setMembers: (members) => set({ members }),
    setGroupMembers: (groupMembers) => set({ groupMembers }),
    updateMemberOnlineStatus: (memberId, isOnline) => set((state) => ({
      members: state.members.map((member) =>
        member.id === memberId ? { ...member, isOnline } : member
      ),
      groupMembers: state.groupMembers.map((member) =>
        member.id === memberId ? { ...member, isOnline } : member
      ),
    })),

    // 更新成员通话状态
    updateMemberCallStatus: (memberId, isInCall) => set((state) => ({
      members: state.members.map((member) =>
        member.id === memberId ? { ...member, isInCall } : member
      ),
    })),
    
    // 语音通话相关
    isInCall: false,
    isJoiningCall: false,
    localStream: null,
    remoteStreams: new Map(),
    activeVoiceChannel: null,
    voiceParticipants: [],
    voiceIsMuted: false,
    voiceIsDeafened: false,
    voiceInputVolume: 100,
    voiceOutputVolume: 100,
    voiceNoiseMode: getStoredVoiceNoiseMode(),
    voiceError: null,
    voiceJoinRequest: null,
    
    joinCall: () => set({ isInCall: true, isJoiningCall: false }),
    leaveCall: () => set({
      isInCall: false,
      isJoiningCall: false,
      localStream: null,
      remoteStreams: new Map(),
      activeVoiceChannel: null,
      voiceParticipants: [],
      voiceIsMuted: false,
      voiceIsDeafened: false,
      voiceError: null
    }),
    toggleMute: () => set((state) => {
      // 这里只是示例，实际的静音逻辑需要在组件中处理
      if (state.localStream) {
        state.localStream.getAudioTracks().forEach(track => {
          track.enabled = !track.enabled;
        });
      }
      return {};
    }),
    setLocalStream: (stream) => set({ localStream: stream, isInCall: true, isJoiningCall: false }),
    addRemoteStream: (userId, stream) => set((state) => {
      const newRemoteStreams = new Map(state.remoteStreams);
      newRemoteStreams.set(userId, stream);
      return { remoteStreams: newRemoteStreams, isInCall: true, isJoiningCall: false };
    }),
    removeRemoteStream: (userId) => set((state) => {
      const newRemoteStreams = new Map(state.remoteStreams);
      newRemoteStreams.delete(userId);
      return { 
        remoteStreams: newRemoteStreams,
        isInCall: newRemoteStreams.size > 0
      };
    }),
    setActiveVoiceChannel: (channel) => set({ activeVoiceChannel: channel }),
    setVoiceParticipants: (participants) => set({ voiceParticipants: participants }),
    setVoiceMuted: (isMuted) => set({ voiceIsMuted: isMuted }),
    setVoiceDeafened: (isDeafened) => set({ voiceIsDeafened: isDeafened }),
    setVoiceInputVolume: (volume) => set({ voiceInputVolume: Math.max(0, Math.min(200, volume)) }),
    setVoiceOutputVolume: (volume) => set({ voiceOutputVolume: Math.max(0, Math.min(100, volume)) }),
    setVoiceNoiseMode: (mode) => {
      saveStoredVoiceNoiseMode(mode);
      set({ voiceNoiseMode: mode });
    },
    setVoiceError: (error) => set({ voiceError: error }),
    requestJoinVoiceChannel: (channel) => set({ voiceJoinRequest: { channel, nonce: Date.now() } }),

    // 屏幕共享状态
    isScreenSharing: false,
    screenShareParticipant: null,
    isScreenShareExpanded: false,
    screenShareTrack: null,
    setScreenSharing: (isSharing) => set({ isScreenSharing: isSharing }),
    setScreenShareParticipant: (participant) => set({ screenShareParticipant: participant }),
    setScreenShareExpanded: (isExpanded) => set({ isScreenShareExpanded: isExpanded }),
    setScreenShareTrack: (track) => set({ screenShareTrack: track }),

    // 私信相关
    activeDirectConversationId: null,
    setActiveDirectConversationId: (conversationId) => set({ activeDirectConversationId: conversationId }),
    
    // 侧边栏状态
    isSidebarOpen: true,
    toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
    isMemberSidebarOpen: true,
    toggleMemberSidebar: () => set((state) => ({ isMemberSidebarOpen: !state.isMemberSidebarOpen })),
  };
});
