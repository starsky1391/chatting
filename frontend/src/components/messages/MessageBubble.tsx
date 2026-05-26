"use client";
/* eslint-disable @next/next/no-img-element */
import React, { useState, KeyboardEvent } from 'react';
import ReactMarkdown from 'react-markdown';
import { config } from '@/lib/config';
import { UserContextMenu, useUserContextMenu } from '@/components/user/UserContextMenu';

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
    avatarUrl?: string;
  };
  createdAt: Date | string;
  isOwn: boolean;
}

interface MessageBubbleProps {
  message: Message;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const { menu, openUserMenu, closeUserMenu } = useUserContextMenu();
  const safeMessage = {
    id: message.id || 0,
    content: message.content || { type: 'text', body: '' },
    sender: {
      id: message.sender?.id || 0,
      username: message.sender?.username || 'Unknown',
      avatar: message.sender?.avatar || 'U',
      avatarUrl: message.sender?.avatarUrl || ''
    },
    createdAt: message.createdAt || new Date(),
    isOwn: message.isOwn || false
  };

  const messageDate = typeof safeMessage.createdAt === 'string' ? new Date(safeMessage.createdAt) : safeMessage.createdAt;

  const isImageMessage = safeMessage.content.body.startsWith('image:') || safeMessage.content.body.startsWith('/uploads/');
  const imagePath = safeMessage.content.body.startsWith('image:')
    ? safeMessage.content.body.replace('image:', '')
    : safeMessage.content.body;
  const imageUrl = isImageMessage ? `${config.api.baseUrl}${imagePath}` : '';

  const [isImageExpanded, setIsImageExpanded] = useState(false);

  const closeImageModal = () => setIsImageExpanded(false);

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') closeImageModal();
  };

  // Render avatar - use image if available, otherwise show initial
  const renderAvatar = () => {
    if (safeMessage.sender.avatarUrl) {
      return (
        <img
          src={`${config.api.baseUrl}${safeMessage.sender.avatarUrl}`}
          alt={safeMessage.sender.username}
          className="w-full h-full object-cover"
        />
      );
    }
    return safeMessage.sender.avatar.charAt(0).toUpperCase();
  };

  return (
    <div className={`flex items-start gap-3 message-bubble ${safeMessage.isOwn ? 'justify-end' : 'justify-start'}`}>
      <UserContextMenu menu={menu} onClose={closeUserMenu} />

      {!safeMessage.isOwn && (
        <div
          className="w-10 h-10 rounded-xl gradient-bg flex items-center justify-center text-sm font-bold shadow-lg overflow-hidden cursor-pointer"
          onContextMenu={(event) => openUserMenu(event, safeMessage.sender)}
        >
          {renderAvatar()}
        </div>
      )}

      <div className="max-w-[70%]">
        <div className={`flex items-center gap-2 mb-1.5 ${safeMessage.isOwn ? 'justify-end' : 'justify-start'}`}>
          <span
            className={`text-sm font-medium cursor-pointer ${safeMessage.isOwn ? 'text-indigo-400' : 'text-zinc-300'}`}
            onContextMenu={(event) => openUserMenu(event, safeMessage.sender)}
          >
            {safeMessage.sender.username}
          </span>
          <span className="text-xs text-zinc-500">
            {messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        {isImageMessage ? (
          <>
            <div className={`rounded-xl p-1 shadow-lg ${safeMessage.isOwn ? 'gradient-bg' : 'bg-zinc-700'}`}>
              <img
                src={imageUrl}
                alt="Chat image"
                className="max-w-full max-h-40 object-contain rounded-lg cursor-pointer transition-all duration-200 hover:opacity-90 hover:scale-[1.02]"
                onClick={() => setIsImageExpanded(true)}
              />
            </div>

            {isImageExpanded && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 modal-backdrop"
                onClick={closeImageModal}
                onKeyDown={handleKeyDown}
                tabIndex={0}
              >
                <div
                  className="relative max-w-4xl max-h-[90vh] animate-fade-in"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={closeImageModal}
                    className="absolute top-4 right-4 w-12 h-12 rounded-full glass hover:bg-red-500/20 text-zinc-400 hover:text-red-400 transition-all flex items-center justify-center"
                    title="Close"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>

                  <img
                    src={imageUrl}
                    alt="Expanded chat image"
                    className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl"
                  />
                </div>
              </div>
            )}
          </>
        ) : (
          <div className={`px-4 py-3 rounded-xl shadow-lg transition-all hover:shadow-xl ${
            safeMessage.isOwn
              ? 'gradient-bg text-white'
              : 'bg-zinc-700 text-zinc-200'
          }`}>
            <div className="prose prose-sm prose-invert max-w-none">
              <ReactMarkdown>
                {safeMessage.content.body || 'No content'}
              </ReactMarkdown>
            </div>
          </div>
        )}
      </div>

      {safeMessage.isOwn && (
        <div
          className="w-10 h-10 rounded-xl gradient-bg flex items-center justify-center text-sm font-bold shadow-lg overflow-hidden cursor-pointer"
          onContextMenu={(event) => openUserMenu(event, safeMessage.sender)}
        >
          {renderAvatar()}
        </div>
      )}
    </div>
  );
};

export default MessageBubble;
