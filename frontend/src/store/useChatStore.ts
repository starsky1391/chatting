import { create } from 'zustand';

// 定义类型
interface User {
  id: number;
  username: string;
  avatar: string;
  email: string;
  status: 'online' | 'idle' | 'do-not-disturb' | 'offline';
  role: 'admin' | 'moderator' | 'member';
}

interface Channel {
  id: number;
  name: string;
  type: 'text' | 'voice';
  isInCall?: boolean;
  callMembers?: number;
}

interface Message {
  id: number;
  content: {
    type: string;
    body: string;
  };
  sender: User;
  createdAt: Date | string;
  isOwn: boolean;
}

interface Member {
  id: number;
  username: string;
  avatar: string;
  status: 'online' | 'idle' | 'do-not-disturb' | 'offline';
  role: 'admin' | 'moderator' | 'member';
  isInCall?: boolean;
}

interface ChatState {
  // 用户信息
  currentUser: User | null;
  isAuthenticated: boolean;
  login: (user: User, token: string) => void;
  logout: () => void;
  updateCurrentUser: (user: Partial<User>) => void;
  
  // 频道相关
  channels: Channel[];
  currentChannel: Channel | null;
  setCurrentChannel: (channel: Channel | null) => void;
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
  
  // 成员相关
  members: Member[];
  setMembers: (members: Member[]) => void;
  updateMemberStatus: (memberId: number, status: Member['status']) => void;
  updateMemberCallStatus: (memberId: number, isInCall: boolean) => void;
  
  // 语音通话相关
  isInCall: boolean;
  isJoiningCall: boolean;
  localStream: MediaStream | null;
  remoteStreams: Map<number, MediaStream>;
  joinCall: () => void;
  leaveCall: () => void;
  toggleMute: () => void;
  setLocalStream: (stream: MediaStream | null) => void;
  addRemoteStream: (userId: number, stream: MediaStream) => void;
  removeRemoteStream: (userId: number) => void;
  
  // 侧边栏状态
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
  isMemberSidebarOpen: boolean;
  toggleMemberSidebar: () => void;
}

// 创建 store
export const useChatStore = create<ChatState>((set) => {
  // 从localStorage获取用户信息
  const savedUser = localStorage.getItem('user');
  const currentUser = savedUser ? JSON.parse(savedUser) : null;
  
  return {
    // 用户信息
    currentUser,
    isAuthenticated: !!currentUser,
    
    login: (user, token) => {
      // 保存到localStorage
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('token', token);
      
      // 更新状态
      set({
        currentUser: user,
        isAuthenticated: true,
      });
    },
    
    logout: () => {
      // 从localStorage移除
      localStorage.removeItem('user');
      localStorage.removeItem('token');
      
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
        remoteStreams: new Map()
      });
    },
    
    updateCurrentUser: (user) => set((state) => ({
      currentUser: state.currentUser ? { ...state.currentUser, ...user } : null
    })),
    
    // 频道相关
    channels: [],
    currentChannel: null,
    setCurrentChannel: (channel) => set({ currentChannel: channel }),
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
    setMessages: (messages) => set((state) => {
      // 确保只设置数组到messages
      const validMessages = Array.isArray(messages) ? messages : [];
      // 按createdAt正序排序
      validMessages.sort((a, b) => {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return dateA - dateB;
      });
      return { messages: validMessages };
    }),
    
    // 成员相关
    members: [],
    setMembers: (members) => set({ members }),
    updateMemberStatus: (memberId, status) => set((state) => ({
      members: state.members.map((member) =>
        member.id === memberId ? { ...member, status } : member
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
    
    joinCall: () => set({ isJoiningCall: true }),
    leaveCall: () => set({
      isInCall: false,
      isJoiningCall: false,
      localStream: null,
      remoteStreams: new Map()
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
    
    // 侧边栏状态
    isSidebarOpen: true,
    toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
    isMemberSidebarOpen: true,
    toggleMemberSidebar: () => set((state) => ({ isMemberSidebarOpen: !state.isMemberSidebarOpen })),
  };
});