"use client";
import React, { useState, useRef, useEffect } from 'react';
import MessageBubble from './MessageBubble';
import { useChatStore } from '../../store/useChatStore';
import { useRouter } from 'next/navigation';
import VoiceRoom from '../voice/VoiceRoom';
import { config } from '@/lib/config';

interface MessageAreaProps {
  onToggleSidebar: () => void;
  onToggleMemberSidebar: () => void;
  currentChannel: any;
  onSendMessage: (content: string) => void;
  onBack: () => void;
}

const MessageArea: React.FC<MessageAreaProps> = ({ onToggleSidebar, onToggleMemberSidebar, currentChannel, onSendMessage, onBack }) => {
  const { messages, logout, isInCall } = useChatStore();
  const [input, setInput] = useState('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  
  // 退出登录处理函数
  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  // 自动滚动到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);



  // 处理图片选择
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // 生成预览URL
      const reader = new FileReader();
      reader.onload = (event) => {
        setPreviewImage(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // 取消图片预览
  const handleCancelPreview = () => {
    setPreviewImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 上传图片到服务器
  const uploadImage = async (file: File): Promise<string | null> => {
    try {
      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch(`${config.api.baseUrl}/api/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error('图片上传失败');
      }

      const data = await response.json();
      return data.data.url;
    } catch (error) {
      console.error('图片上传错误:', error);
      return null;
    }
  };

  // 处理发送图片
  const handleSendImage = async () => {
    if (!fileInputRef.current?.files?.[0] || !currentChannel) return;

    setIsUploading(true);
    try {
      const file = fileInputRef.current.files[0];
      const imageUrl = await uploadImage(file);
      
      if (imageUrl) {
        onSendMessage(imageUrl);
        setPreviewImage(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    } catch (error) {
      console.error('发送图片错误:', error);
    } finally {
      setIsUploading(false);
    }
  };

  // 处理发送消息
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !currentChannel) return;

    onSendMessage(input);
    setInput('');
  };



  // 处理返回按钮点击
  const handleBackClick = () => {
    // 返回空白页
    onBack();
  };
  
  // 渲染通用 Header
  const renderHeader = () => (
    <div className="p-4 border-b border-gray-700 bg-gray-800 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <button 
          className="md:hidden p-2 rounded-lg hover:bg-gray-700" 
          onClick={onToggleSidebar}
        >
          ☰
        </button>
        {/* 返回按钮 */}
        <button
          className="p-1.5 rounded-md hover:bg-gray-700 transition-colors flex items-center justify-center"
          onClick={handleBackClick}
          title="退出频道"
        >
          ←
        </button>
        <h2 className="text-lg font-semibold">
          {currentChannel.type === 'voice' ? '🎤' : '#'} {currentChannel.name}
        </h2>
      </div>
      <div className="flex items-center gap-2">
        {currentChannel.type === 'voice' && (
          <div className="flex items-center gap-2">
            {isInCall ? (
              <span className="text-xs text-green-400 animate-pulse">
                通话中
              </span>
            ) : (
              <span className="text-xs text-gray-400">
                语音频道
              </span>
            )}
          </div>
        )}
        <button 
          className="md:hidden p-2 rounded-lg hover:bg-gray-700" 
          onClick={onToggleMemberSidebar}
        >
          👥
        </button>
      </div>
    </div>
  );
  
  // 渲染文本频道内容
  const renderTextChannelContent = () => (
    <div className="flex flex-col h-full">
      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {Array.isArray(messages) ? (
          messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))
        ) : (
          <div className="text-gray-500 text-center py-4">
            No messages found
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 图片预览 */}
      {previewImage && (
        <div className="p-4 border-t border-gray-700 bg-gray-800">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <h3 className="font-medium">图片预览</h3>
              <button
                onClick={handleCancelPreview}
                className="text-red-400 hover:text-red-300 text-sm"
              >
                取消
              </button>
            </div>
            <div className="relative max-w-md">
              <img
                src={previewImage}
                alt="预览"
                className="max-h-60 object-contain rounded-lg border border-gray-600"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={handleCancelPreview}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSendImage}
                disabled={isUploading}
                className={`px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isUploading ? '发送中...' : '发送图片'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 消息输入框 */}
      <div className="p-4 border-t border-gray-700 bg-gray-800">
        <form onSubmit={handleSendMessage} className="flex gap-2">
          {/* 图片选择按钮 */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors flex items-center justify-center"
            title="选择图片"
          >
            📷
          </button>
          
          {/* 隐藏的文件输入 */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImageSelect}
            accept="image/*"
            className="hidden"
          />
          
          {/* 消息输入框 */}
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message... (supports Markdown)"
            className="flex-1 p-3 rounded-lg bg-gray-700 border border-gray-600 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isUploading}
          />
          
          {/* 发送按钮 */}
          <button
            type="submit"
            disabled={isUploading}
            className={`px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isUploading ? '发送中...' : 'Send'}
          </button>
        </form>
      </div>
    </div>
  );
  
  // 渲染语音频道内容
  const renderVoiceChannelContent = () => (
    <VoiceRoom currentChannel={currentChannel} onBack={handleBackClick} />
  );
  
  // 条件渲染
  if (!currentChannel) {
    return <div className="flex-1 bg-gray-900"></div>;
  }
  
  return (
    <div className="flex flex-col h-full">
      {/* 通用 Header */}
      {renderHeader()}
      
      {/* 内容区域 */}
      <div className="flex-1">
        {currentChannel.type === 'voice' ? renderVoiceChannelContent() : renderTextChannelContent()}
      </div>
    </div>
  );
};

export default MessageArea;