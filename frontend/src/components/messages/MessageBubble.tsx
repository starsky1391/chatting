"use client";
import React, { useState, KeyboardEvent } from 'react';
import ReactMarkdown from 'react-markdown';

interface Message {
  id: number;
  content: {
    type: string;
    body: string;
  };
  sender: {
    id: number;
    username: string;
    avatar: string;
  };
  createdAt: Date | string;
  isOwn: boolean;
}

interface MessageBubbleProps {
  message: Message;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  // 确保message对象有效，提供默认值
  const safeMessage = {
    id: message.id || 0,
    content: message.content || { type: 'text', body: '' },
    sender: {
      id: message.sender?.id || 0,
      username: message.sender?.username || 'Unknown',
      avatar: message.sender?.avatar || 'U'
    },
    createdAt: message.createdAt || new Date(),
    isOwn: message.isOwn || false
  };
  
  // 确保createdAt是Date对象
  const messageDate = typeof safeMessage.createdAt === 'string' ? new Date(safeMessage.createdAt) : safeMessage.createdAt;
  
  // 判断是否为图片消息
  const isImageMessage = safeMessage.content.body.startsWith('image:');
  const imagePath = isImageMessage ? safeMessage.content.body.replace('image:', '') : '';
  const imageUrl = isImageMessage ? `http://localhost:3001${imagePath}` : '';

  // 图片展开状态管理
  const [isImageExpanded, setIsImageExpanded] = useState(false);

  // 关闭图片展开模态框
  const closeImageModal = () => {
    setIsImageExpanded(false);
  };

  // 处理键盘事件，支持ESC键关闭图片
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      closeImageModal();
    }
  };

  // 基于消息是否属于当前用户来渲染不同的对齐方式
  return (
    <div className={`flex items-start gap-3 ${safeMessage.isOwn ? 'justify-end' : 'justify-start'}`}>
      {/* 别人的消息：头像在左侧 */}
      {!safeMessage.isOwn && (
        <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold">
          {safeMessage.sender.avatar.charAt(0).toUpperCase()}
        </div>
      )}
      
      <div className="max-w-[70%]">
        <div className={`flex items-center gap-2 mb-1 ${safeMessage.isOwn ? 'justify-end' : 'justify-start'}`}>
          <span className="text-sm font-medium text-gray-300">{safeMessage.sender.username}</span>
          <span className="text-xs text-gray-500">
            {messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
        
        {/* 根据消息类型渲染不同内容 */}
        {isImageMessage ? (
          <>
            {/* 图片消息容器 - 缩略图 */}
            <div className={`rounded-lg p-1 shadow-sm ${safeMessage.isOwn ? 'bg-blue-600' : 'bg-gray-700'}`}>
              <img
                src={imageUrl}
                alt="Chat image"
                className="max-w-full max-h-32 object-contain rounded cursor-pointer transition-all duration-200 hover:opacity-90"
                onClick={() => setIsImageExpanded(true)}
              />
            </div>
            
            {/* 图片展开模态框 */}
            {isImageExpanded && (
              <div 
                className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80 p-4"
                onClick={closeImageModal}
                onKeyDown={handleKeyDown}
                tabIndex={0}
              >
                <div 
                  className="relative max-w-4xl max-h-[90vh] flex flex-col items-end"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* 关闭按钮 */}
                  <button
                    onClick={closeImageModal}
                    className="absolute top-4 right-4 w-10 h-10 bg-red-600 hover:bg-red-700 rounded-full flex items-center justify-center text-white transition-all duration-200 z-10"
                    title="关闭"
                  >
                    ✕
                  </button>
                  
                  {/* 展开的图片 */}
                  <div className="relative w-full h-full">
                    <img
                      src={imageUrl}
                      alt="Expanded chat image"
                      className="max-w-full max-h-[90vh] object-contain rounded"
                    />
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className={`p-3 rounded-lg shadow-sm ${safeMessage.isOwn ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-200'}`}>
            <ReactMarkdown>{safeMessage.content.body || 'No content'}</ReactMarkdown>
          </div>
        )}
      </div>
      
      {/* 自己的消息：头像在右侧 */}
      {safeMessage.isOwn && (
        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold">
          {safeMessage.sender.avatar.charAt(0).toUpperCase()}
        </div>
      )}
    </div>
  );
};

export default MessageBubble;