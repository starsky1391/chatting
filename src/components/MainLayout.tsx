"use client";  // 标记为客户端组件
// Next.js 14的App Router要求客户端组件使用此指令
// 客户端组件可以使用React Hooks和浏览器API

// 导入React和必要的hooks
import React, { useEffect, useState } from 'react';
// 导入Tailwind CSS工具类，用于条件样式
import { cn } from '@/lib/utils';
// 导入状态管理
import { useChatStore } from '@/store/useChatStore';
// 导入消息区域组件
import MessageArea from './messages/MessageArea';
// 导入频道列表组件
import ChannelList from './sidebar/ChannelList';
// 导入成员列表组件
import MemberList from './members/MemberList';
// 导入Socket.io钩子
import { useSocket } from '../hooks/useSocket';
// 导入配置
import { config } from '@/lib/config';
// 导入API客户端
import { api } from '../lib/api';

// 主布局组件
// 应用的核心布局，包含侧边栏、消息区域和成员列表
// 响应式设计，适配不同屏幕尺寸
const MainLayout: React.FC = () => {
  // 从状态管理获取数据
  // useChatStore是自定义钩子，返回聊天相关状态
  const {
    currentUser,
    currentChannel,
    channels,
    setCurrentChannel,
    members,
    messages,
    setMessages,
    addMessage,
    setMembers,
    setChannels
  } = useChatStore();

  // 状态管理：侧边栏显示状态
  // 用于控制移动端侧边栏的展开和折叠
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  // 状态管理：成员侧边栏显示状态
  const [isMemberSidebarOpen, setIsMemberSidebarOpen] = useState(false);

  // 使用Socket.io钩子连接后端
  // 后端Socket.io服务运行在配置的地址
  const {
    isConnected,
    socketError,
    connect,
    emit,
    on,
    resetReconnectState
  } = useSocket({
    url: config.api.socketUrl, // 后端Socket.io服务地址
    autoConnect: true // 自动连接
  });

  // 检查socket错误
  useEffect(() => {
    if (socketError) {
      console.error('Socket连接错误:', socketError);
      // 尝试重新连接
      setTimeout(() => {
        connect();
      }, 2000);
    }
  }, [socketError, connect]);



  // 监听Socket.io消息
  // 当收到message:create事件时，添加消息到状态管理
  useEffect(() => {
    // 监听新消息
    const handleMessageCreate = (message: any) => {
      // 检查消息是否已经存在，避免重复添加
      const isDuplicate = messages.some(m => m.id === message.id);
      if (!isDuplicate) {
        // 添加isOwn属性，标识是否是当前用户发送的消息
        const messageWithOwnership = {
          ...message,
          isOwn: message.sender?.id === (currentUser?.id || 0)
        };
        addMessage(messageWithOwnership);
      }
    };

    // 注册事件监听器
    const unsubscribeMessageCreate = on('message:create', handleMessageCreate);

    // 组件卸载时移除监听
    return () => {
      unsubscribeMessageCreate();
    };
  }, [on, addMessage, messages, currentUser]);

  // 频道切换时加入/离开Socket.io房间
  useEffect(() => {
    if (!currentChannel) return;

    // 加入当前频道的房间
    emit('join-channel', currentChannel.id);
    
    // 获取当前频道的消息
    const fetchMessages = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          console.error('No token found, please login again');
          setMessages([]);
          return;
        }
        
        console.log('Fetching messages for channel:', currentChannel.id);
        try {
          const response = await fetch(`http://localhost:3001/api/channels/${currentChannel.id}/messages`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          console.log('Messages fetch response:', response);
          
          if (response.ok) {
            try {
              const data = await response.json();
              console.log('Messages data:', data);
              // 确保data.data是数组，否则使用空数组
              const messagesArray = Array.isArray(data.data) ? data.data : [];
              // 为每条消息添加isOwn属性
              const messagesWithOwnership = messagesArray.map((message: any) => ({
                ...message,
                isOwn: message.sender?.id === (currentUser?.id || 0)
              }));
              setMessages(messagesWithOwnership);
              console.log('Messages set successfully:', messagesWithOwnership.length, 'messages');
            } catch (jsonError) {
              console.error('Error parsing messages response:', jsonError);
              setMessages([]);
            }
          } else {
            console.error(`Failed to fetch messages: ${response.status} ${response.statusText}`);
            // 尝试获取错误详情
            try {
              const errorData = await response.json();
              console.error('Messages error data:', errorData);
            } catch (e) {
              console.error('Failed to parse error response:', e);
            }
            setMessages([]);
          }
        } catch (networkError) {
          console.error('Network error fetching messages:', networkError);
          // 后端服务器未运行时的处理
          console.log('后端服务器可能未运行，使用空消息列表');
          setMessages([]);
        }
      } catch (error) {
        console.error('Unexpected error in fetchMessages:', error);
        setMessages([]);
      }
    };

    // 获取当前频道的成员
    const fetchMembers = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          console.error('No token found, please login again');
          setMembers([]);
          return;
        }
        
        console.log('Fetching members for channel:', currentChannel.id);
        try {
          const response = await fetch(`http://localhost:3001/api/channels/${currentChannel.id}/members`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          console.log('Members fetch response:', response);
          
          if (response.ok) {
            try {
              const data = await response.json();
              console.log('Members data:', data);
              setMembers(Array.isArray(data.data) ? data.data : []);
              console.log('Members set successfully:', Array.isArray(data.data) ? data.data.length : 0, 'members');
            } catch (jsonError) {
              console.error('Error parsing members response:', jsonError);
              setMembers([]);
            }
          } else {
            console.error(`Failed to fetch members: ${response.status} ${response.statusText}`);
            // 尝试获取错误详情
            try {
              const errorData = await response.json();
              console.error('Members error data:', errorData);
            } catch (e) {
              console.error('Failed to parse error response:', e);
            }
            setMembers([]);
          }
        } catch (networkError) {
          console.error('Network error fetching members:', networkError);
          // 后端服务器未运行时的处理
          console.log('后端服务器可能未运行，使用空成员列表');
          setMembers([]);
        }
      } catch (error) {
        console.error('Unexpected error in fetchMembers:', error);
        setMembers([]);
      }
    };

    fetchMessages();
    fetchMembers();

    // 清理函数：离开当前频道房间
    return () => {
      emit('leave-channel', currentChannel.id);
    };
  }, [currentChannel, emit, setMessages, setMembers]);

  // 从后端API获取初始数据
  useEffect(() => {
    // 获取频道列表
    const fetchChannels = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          setChannels([]);
          return;
        }
        
        try {
          const data = await api.get('/api/channels');
          setChannels(Array.isArray(data) ? data : []);
        } catch (networkError) {
          // 后端服务器未运行时的处理
          // 设置默认频道数据，确保应用能正常显示
          const defaultChannels = [
            { id: 1, name: 'general', type: 'text' as const, description: 'General discussion channel for all topics' },
            { id: 2, name: 'random', type: 'text' as const, description: 'Random topics and fun conversations' },
            { id: 3, name: 'development', type: 'text' as const, description: 'Development and coding discussion' },
            { id: 4, name: 'design', type: 'text' as const, description: 'Design and UI/UX discussion' },
            { id: 5, name: 'help', type: 'text' as const, description: 'Get help with technical issues' },
            { id: 6, name: 'announcements', type: 'text' as const, description: 'Important announcements and updates' },
            { id: 7, name: 'voice-general', type: 'voice' as const, description: 'General voice channel for casual chat' },
            { id: 8, name: 'voice-meeting', type: 'voice' as const, description: 'Voice channel for team meetings' },
            { id: 9, name: 'voice-gaming', type: 'voice' as const, description: 'Voice channel for gaming sessions' }
          ];
          setChannels(defaultChannels);
        }
      } catch (error) {
        setChannels([]);
      }
    };

    fetchChannels();
  }, [setChannels]);

  // 响应式设计：根据屏幕宽度自动调整布局
  // useEffect钩子，当组件挂载或屏幕尺寸变化时执行
  useEffect(() => {
    // 处理窗口大小变化事件
    const handleResize = () => {
      // 屏幕宽度小于768px时，关闭侧边栏
      // 768px是Tailwind的md断点
      if (window.innerWidth < 768) {
        setIsSidebarOpen(false);
      }
    };

    // 事件监听：窗口大小变化
    window.addEventListener('resize', handleResize);
    // 清理函数：移除事件监听
    return () => window.removeEventListener('resize', handleResize);
  }, [setIsSidebarOpen]);

  // 网络状态监控
  useEffect(() => {
    const handleOnline = () => {
      // 网络恢复时重置重连状态并尝试重连
      resetReconnectState();
      connect();
    };
    
    const handleOffline = () => {
      // 网络离线时的处理
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [connect, resetReconnectState]);

  // 处理发送消息
  // 调用后端API发送消息
  const handleSendMessage = async (content: string) => {
    try {
      if (!currentChannel) {
        console.error('No current channel selected');
        return;
      }
      
      // 调用后端API发送消息
      const response = await fetch(`http://localhost:3001/api/channels/${currentChannel.id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}` // 发送JWT令牌
        },
        body: JSON.stringify({ content })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Failed to send message: ${response.status} ${response.statusText} ${JSON.stringify(errorData)}`);
      }

      // 消息发送成功，后端会通过Socket.io广播，不需要手动添加
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  // 渲染主布局
  return (
    <div className="flex h-screen bg-gray-900 text-white">
      {/* 左侧频道列表 */}
      {/* 移动端侧边栏使用固定定位，方便切换 */}
      <aside 
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 bg-gray-800 border-r border-gray-700 transition-transform duration-300 ease-in-out',
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
          'md:relative md:translate-x-0'
        )}
      >
        {/* 频道列表组件 */}
        <ChannelList />
      </aside>

      {/* 主内容区域 */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* 消息区域组件 */}
        <MessageArea 
          currentChannel={currentChannel} 
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          onToggleMemberSidebar={() => setIsMemberSidebarOpen(!isMemberSidebarOpen)}
          onSendMessage={handleSendMessage}
          onBack={() => {
            // 返回空白页，将currentChannel设置为null
            setCurrentChannel(null);
          }}
        />
      </main>

      {/* 右侧成员列表 */}
      {/* 响应式设计：大屏幕显示，小屏幕隐藏 */}
      <aside className={cn(
        'hidden lg:block w-64 bg-gray-800 border-l border-gray-700 overflow-y-auto',
        isMemberSidebarOpen && 'fixed inset-y-0 right-0 z-50 transition-transform duration-300 ease-in-out translate-x-0'
      )}>
        {/* 成员列表组件 */}
        <MemberList />
      </aside>

      {/* 移动端侧边栏切换按钮 */}
      {/* 小屏幕显示，用于切换频道侧边栏 */}
      <button
        className="fixed top-4 left-4 z-50 md:hidden bg-blue-600 p-2 rounded-md text-white hover:bg-blue-700 transition-colors"
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {/* 汉堡菜单图标 */}
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* 移动端成员列表切换按钮 */}
      <button
        className="fixed top-4 right-4 z-50 md:hidden bg-blue-600 p-2 rounded-md text-white hover:bg-blue-700 transition-colors"
        onClick={() => setIsMemberSidebarOpen(!isMemberSidebarOpen)}
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {/* 用户图标 */}
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 1 1 0 5.292M15 21H3v-1a6 6 0 0 1 12 0v1zm0 0h6v-1a6 6 0 0 0-9-5.197M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0z" />
        </svg>
      </button>

      {/* Socket连接状态指示器 */}
      <div className={cn(
        'fixed bottom-4 right-4 px-3 py-1 rounded-full text-xs font-medium flex items-center gap-2',
        isConnected ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
      )}>
        <div className={cn(
          'w-2 h-2 rounded-full',
          isConnected ? 'bg-white animate-pulse' : 'bg-white'
        )} />
        {isConnected ? 'Online' : 'Offline (Using default data)'}
      </div>
    </div>
  );
};

export default MainLayout;