"use client";
import React, { useState } from 'react';
import { useChatStore } from '../../store/useChatStore';
import { useRouter } from 'next/navigation';
import { config } from '@/lib/config';

const ChannelList: React.FC = () => {
  const { channels, currentChannel, setCurrentChannel, leaveChannel, addChannel, currentUser, logout } = useChatStore();
  const router = useRouter();
  
  // 模态框状态
  const [isModalOpen, setIsModalOpen] = useState(false);
  // 新频道表单状态
  const [newChannel, setNewChannel] = useState({
    name: '',
    type: 'text' as 'text' | 'voice'
  });

  // 打开创建频道模态框
  const handleOpenModal = () => {
    setIsModalOpen(true);
  };

  // 关闭创建频道模态框
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setNewChannel({ name: '', type: 'text' });
  };

  // 处理表单输入变化
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setNewChannel(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // 创建新频道
  const handleCreateChannel = async () => {
    if (!newChannel.name.trim()) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${config.api.baseUrl}/api/channels`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newChannel)
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', response.headers);
      
      const responseData = await response.json();
      console.log('Response data:', responseData);

      if (!response.ok) {
        throw new Error(`Failed to create channel: ${response.status} ${JSON.stringify(responseData)}`);
      }

      addChannel(responseData.data);
      handleCloseModal();
    } catch (error) {
      console.error('Error creating channel:', error);
    }
  };

  // 处理离开频道
  const handleLeaveChannel = async (channelId: number) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:3001/api/channels/${channelId}/leave`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to leave channel');
      }

      leaveChannel(channelId);
    } catch (error) {
      console.error('Error leaving channel:', error);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* 服务器名称和创建频道按钮 */}
      <div className="p-4 border-b border-gray-700">
        <h1 className="text-xl font-bold">ChatApp</h1>
        <button 
          className="mt-2 text-xs bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded-full transition-colors"
          onClick={handleOpenModal}
        >
          + Create Channel
        </button>
      </div>

      {/* 当前用户信息 */}
      {currentUser && (
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-white font-bold">
                {currentUser.avatar || currentUser.username.charAt(0).toUpperCase()}
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium">{currentUser.username}</span>
                <span className="text-xs text-gray-400">{currentUser.status}</span>
              </div>
            </div>
            <button
              className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded-lg text-xs font-medium transition-colors"
              onClick={() => {
                logout();
                router.push('/login');
              }}
            >
              Logout
            </button>
          </div>
        </div>
      )}

      {/* 频道列表 */}
      <div className="flex-1 overflow-y-auto p-2">
        {/* 文本频道 - 竖状滑动条 */}
        <div className="mb-4">
          <h2 className="text-xs font-semibold text-gray-400 uppercase mb-2">Text Channels</h2>
          <div className="space-y-1 min-h-[120px]">
            {channels.filter(channel => channel.type === 'text').length > 0 ? (
              channels.filter(channel => channel.type === 'text').map(channel => (
                <div 
                  key={channel.id} 
                  className={`px-4 py-2 rounded-lg cursor-pointer transition-colors ${currentChannel?.id === channel.id ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}
                >
                  <div className="flex justify-between items-center">
                    <span onClick={() => setCurrentChannel(channel)} className="cursor-pointer"># {channel.name}</span>
                    <button 
                      className="text-gray-400 hover:text-white ml-2 text-sm"
                      onClick={() => handleLeaveChannel(channel.id)}
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))
            ) : (
              // 没有频道时显示占位符，保留3个频道的空间
              Array(3).fill(0).map((_, index) => (
                <div 
                  key={`text-placeholder-${index}`} 
                  className="px-4 py-2 rounded-lg text-gray-500 bg-gray-800 opacity-50"
                >
                  <span># Empty Channel {index + 1}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 语音频道 - 竖状滑动条 */}
        <div>
          <h2 className="text-xs font-semibold text-gray-400 uppercase mb-2">Voice Channels</h2>
          <div className="space-y-1 min-h-[120px]">
            {channels.filter(channel => channel.type === 'voice').length > 0 ? (
              channels.filter(channel => channel.type === 'voice').map(channel => (
                <div 
                  key={channel.id} 
                  className={`px-4 py-2 rounded-lg cursor-pointer transition-colors ${currentChannel?.id === channel.id ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}
                >
                  <div className="flex justify-between items-center">
                    <span onClick={() => setCurrentChannel(channel)} className="cursor-pointer">🎤 {channel.name}</span>
                    <button 
                      className="text-gray-400 hover:text-white ml-2 text-sm"
                      onClick={() => handleLeaveChannel(channel.id)}
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))
            ) : (
              // 没有频道时显示占位符，保留3个频道的空间
              Array(3).fill(0).map((_, index) => (
                <div 
                  key={`voice-placeholder-${index}`} 
                  className="px-4 py-2 rounded-lg text-gray-500 bg-gray-800 opacity-50"
                >
                  <span>🎤 Empty Voice Channel {index + 1}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 创建频道模态框 */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Create New Channel</h2>
              <button 
                className="text-gray-400 hover:text-white text-xl"
                onClick={handleCloseModal}
              >
                ×
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Channel Name</label>
                <input 
                  type="text" 
                  name="name" 
                  value={newChannel.name} 
                  onChange={handleInputChange}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter channel name"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Channel Type</label>
                <select 
                  name="type" 
                  value={newChannel.type} 
                  onChange={handleInputChange}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="text">Text Channel</option>
                  <option value="voice">Voice Channel</option>
                </select>
              </div>
              
              <div className="flex justify-end space-x-3 pt-4">
                <button 
                  className="px-4 py-2 bg-gray-700 text-gray-300 rounded hover:bg-gray-600 transition-colors"
                  onClick={handleCloseModal}
                >
                  Cancel
                </button>
                <button 
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                  onClick={handleCreateChannel}
                  disabled={!newChannel.name.trim()}
                >
                  Create Channel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChannelList;