"use client";
/* eslint-disable @next/next/no-img-element */
import React, { useEffect, useRef, useState, KeyboardEvent } from 'react';
import ReactMarkdown from 'react-markdown';
import { config } from '@/lib/config';
import { UserContextMenu, useUserContextMenu } from '@/components/user/UserContextMenu';
import { RotateCcw } from 'lucide-react';
import { roleLabel } from '@/lib/roles';

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
    groupRole?: string;
  };
  createdAt: Date | string;
  isOwn: boolean;
}

interface MessageBubbleProps {
  message: Message;
  onRecall?: (messageId: number) => Promise<void>;
  onMentionUser?: (username: string) => void;
}

const emphasizeMentions = (content: string) => (
  content.replace(/(^|[\s(])@([^\s@.,:;!?，。！？、)]+)/g, '$1**@$2**')
);

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, onRecall, onMentionUser }) => {
  const { menu, openUserMenu, openUserMenuAtElement, closeUserMenu } = useUserContextMenu();
  const [now, setNow] = useState(() => Date.now());
  const [isRecalling, setIsRecalling] = useState(false);
  const [recallError, setRecallError] = useState('');
  const avatarClickTimerRef = useRef<number | null>(null);
  const avatarRef = useRef<HTMLDivElement | null>(null);
  const safeMessage = {
    id: message.id || 0,
    content: message.content || { type: 'text', body: '' },
    sender: {
      id: message.sender?.id || 0,
      username: message.sender?.username || 'Unknown',
      avatar: message.sender?.avatar || 'U',
      avatarUrl: message.sender?.avatarUrl || '',
      groupRole: message.sender?.groupRole || ''
    },
    createdAt: message.createdAt || new Date(),
    isOwn: message.isOwn || false
  };

  const messageDate = typeof safeMessage.createdAt === 'string' ? new Date(safeMessage.createdAt) : safeMessage.createdAt;
  const recallSecondsLeft = Math.max(0, Math.ceil((messageDate.getTime() + 30_000 - now) / 1000));
  const canRecall = Boolean(onRecall && safeMessage.isOwn && safeMessage.id && recallSecondsLeft > 0);

  const isImageMessage = safeMessage.content.body.startsWith('image:') || safeMessage.content.body.startsWith('/uploads/');
  const imagePath = safeMessage.content.body.startsWith('image:')
    ? safeMessage.content.body.replace('image:', '')
    : safeMessage.content.body;
  const imageUrl = isImageMessage ? `${config.api.baseUrl}${imagePath}` : '';

  const [isImageExpanded, setIsImageExpanded] = useState(false);

  const closeImageModal = () => setIsImageExpanded(false);

  useEffect(() => {
    if (!safeMessage.isOwn || recallSecondsLeft <= 0) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [safeMessage.isOwn, recallSecondsLeft]);

  useEffect(() => {
    return () => {
      if (avatarClickTimerRef.current) {
        window.clearTimeout(avatarClickTimerRef.current);
      }
    };
  }, []);

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') closeImageModal();
  };

  const handleRecall = async () => {
    if (!onRecall || !canRecall || isRecalling) return;
    setIsRecalling(true);
    setRecallError('');
    try {
      await onRecall(safeMessage.id);
    } catch (error) {
      setRecallError(error instanceof Error ? error.message : '撤回消息失败');
    } finally {
      setIsRecalling(false);
    }
  };

  const handleAvatarClick = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const anchor = event.currentTarget;

    if (avatarClickTimerRef.current) {
      window.clearTimeout(avatarClickTimerRef.current);
    }

    avatarClickTimerRef.current = window.setTimeout(() => {
      openUserMenuAtElement(anchor, safeMessage.sender);
      avatarClickTimerRef.current = null;
    }, 180);
  };

  const openSenderMenu = (event: React.MouseEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (avatarRef.current) {
      openUserMenuAtElement(avatarRef.current, safeMessage.sender);
      return;
    }
    openUserMenu(event, safeMessage.sender);
  };

  const handleAvatarDoubleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();

    if (avatarClickTimerRef.current) {
      window.clearTimeout(avatarClickTimerRef.current);
      avatarClickTimerRef.current = null;
    }

    closeUserMenu();
    onMentionUser?.(safeMessage.sender.username);
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
    <div className={`group flex items-start gap-3 message-bubble ${safeMessage.isOwn ? 'justify-end' : 'justify-start'}`}>
      <UserContextMenu menu={menu} onClose={closeUserMenu} />

      {!safeMessage.isOwn && (
        <div
          ref={avatarRef}
          className="w-10 h-10 rounded-xl gradient-bg flex items-center justify-center text-sm font-bold shadow-lg overflow-hidden cursor-pointer"
          onClick={handleAvatarClick}
          onDoubleClick={handleAvatarDoubleClick}
          onContextMenu={(event) => openUserMenu(event, safeMessage.sender)}
          title="单击查看资料，双击 @他"
        >
          {renderAvatar()}
        </div>
      )}

      <div className="max-w-[70%]">
        <div className={`flex items-center gap-2 mb-1.5 ${safeMessage.isOwn ? 'justify-end' : 'justify-start'}`}>
          {canRecall && safeMessage.isOwn && (
            <button
              type="button"
              onClick={handleRecall}
              disabled={isRecalling}
              className="inline-flex items-center gap-1 rounded-md border border-zinc-700/70 bg-zinc-900/80 px-2 py-0.5 text-[11px] text-zinc-300 opacity-0 transition-all hover:border-amber-500/50 hover:text-amber-300 disabled:cursor-not-allowed disabled:opacity-50 group-hover:opacity-100"
              title={`还剩 ${recallSecondsLeft} 秒可撤回`}
            >
              <RotateCcw className="h-3 w-3" />
              {isRecalling ? '撤回中' : `撤回 ${recallSecondsLeft}s`}
            </button>
          )}
          <span
            className={`text-sm font-medium cursor-pointer ${safeMessage.isOwn ? 'text-indigo-400' : 'text-zinc-300'}`}
            onClick={openSenderMenu}
            onContextMenu={openSenderMenu}
          >
            {safeMessage.sender.username}
          </span>
          {safeMessage.sender.groupRole && (
            <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-300">
              {roleLabel(safeMessage.sender.groupRole)}
            </span>
          )}
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
                {emphasizeMentions(safeMessage.content.body || 'No content')}
              </ReactMarkdown>
            </div>
          </div>
        )}
        {recallError && (
          <div className={`mt-1 text-xs text-red-300 ${safeMessage.isOwn ? 'text-right' : 'text-left'}`}>
            {recallError}
          </div>
        )}
      </div>

      {safeMessage.isOwn && (
        <div
          ref={avatarRef}
          className="w-10 h-10 rounded-xl gradient-bg flex items-center justify-center text-sm font-bold shadow-lg overflow-hidden cursor-pointer"
          onClick={handleAvatarClick}
          onDoubleClick={handleAvatarDoubleClick}
          onContextMenu={(event) => openUserMenu(event, safeMessage.sender)}
          title="单击查看资料，双击 @他"
        >
          {renderAvatar()}
        </div>
      )}
    </div>
  );
};

export default MessageBubble;
