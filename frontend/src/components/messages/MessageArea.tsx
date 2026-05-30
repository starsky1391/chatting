"use client";
import React, { useEffect, useMemo, useState } from 'react';
import { History } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import MessageBubble from './MessageBubble';
import MessageComposer from './MessageComposer';
import HistoryPanel from './HistoryPanel';
import VoiceChannelNotice from './VoiceChannelNotice';
import { useChatStore } from '../../store/useChatStore';
import { SkeletonMessageList } from '../ui/Skeleton';
import { useChannelMessages } from '@/hooks/useChannelMessages';
import { useMentionInput } from '@/hooks/useMentionInput';
import { usePageActivity } from '@/hooks/usePageActivity';
import { useVirtualMessageWindow } from '@/hooks/useVirtualMessageWindow';
import type { Channel, MentionMember } from './types';

const RECALL_WINDOW_MS = 30_000;

const isMessageRecallable = (message: { isOwn?: boolean; createdAt?: string | Date }, now: number) => {
  if (!message.isOwn || !message.createdAt) return false;
  return now - new Date(message.createdAt).getTime() < RECALL_WINDOW_MS;
};

interface MessageAreaProps {
  currentChannel: Channel | null;
  onSendMessage: (content: string) => void;
  onRecallMessage?: (messageId: number) => Promise<void>;
  onBack: () => void;
  isLoading?: boolean;
  showHeader?: boolean;
}

const MessageArea: React.FC<MessageAreaProps> = ({
  currentChannel,
  onSendMessage,
  onRecallMessage,
  isLoading = false,
}) => {
  const {
    messages,
    currentUser,
    setMessages,
    isInCall,
    activeVoiceChannel,
    voiceParticipants,
    voiceError,
    requestJoinVoiceChannel,
    groupMembers,
  } = useChatStore(
    useShallow((state) => ({
      messages: state.messages,
      currentUser: state.currentUser,
      setMessages: state.setMessages,
      isInCall: state.isInCall,
      activeVoiceChannel: state.activeVoiceChannel,
      voiceParticipants: state.voiceParticipants,
      voiceError: state.voiceError,
      requestJoinVoiceChannel: state.requestJoinVoiceChannel,
      groupMembers: state.groupMembers,
    }))
  );

  const [isHistoryPanelOpen, setIsHistoryPanelOpen] = useState(false);
  const [recallNow, setRecallNow] = useState(() => Date.now());
  const isPageActive = usePageActivity();

  const members = useMemo(() => groupMembers as MentionMember[], [groupMembers]);

  const historySenderOptions = useMemo(() => {
    const uniqueMembers = new Map<number, MentionMember>();
    members.forEach((member) => {
      if (!member?.id || !member.username) return;
      uniqueMembers.set(member.id, member);
    });

    return Array.from(uniqueMembers.values())
      .sort((a, b) => {
        const aIsBot = a.groupRole === 'bot' || a.role === 'bot' || a.username === 'AI';
        const bIsBot = b.groupRole === 'bot' || b.role === 'bot' || b.username === 'AI';
        if (aIsBot !== bIsBot) return aIsBot ? -1 : 1;
        return a.username.localeCompare(b.username, 'zh-Hans-CN');
      });
  }, [members]);

  const {
    pageSize,
    setPageSize,
    historyDate,
    setHistoryDate,
    activeHistoryDate,
    highlightMessageId,
    isHistoryLoading,
    hasMoreHistory,
    messagesEndRef,
    messageListRef,
    messageRefs,
    fetchChannelMessages,
    openDayHistoryView,
    clearHistoryDate,
    handleMessageWheel,
    markShouldAutoScroll,
  } = useChannelMessages({
    currentChannel,
    currentUserId: currentUser?.id || 0,
    messages,
    setMessages,
  });

  const mentionInput = useMentionInput({
    members,
    isEnabled: currentChannel?.type === 'text',
    onSendMessage,
    onBeforeSend: markShouldAutoScroll,
  });

  const {
    visibleItems: visibleMessages,
    topPadding,
    bottomPadding,
    isVirtualized,
    syncViewport,
  } = useVirtualMessageWindow({
    items: messages,
    containerRef: messageListRef,
  });

  useEffect(() => {
    if (!isPageActive) return;

    if (!messages.some((message) => isMessageRecallable(message, Date.now()))) {
      return;
    }

    const timer = window.setInterval(() => {
      const currentNow = Date.now();
      setRecallNow(currentNow);

      if (!messages.some((message) => isMessageRecallable(message, currentNow))) {
        window.clearInterval(timer);
      }
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [isPageActive, messages]);

  if (!currentChannel) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-indigo-500/20 mb-6">
            <svg className="w-10 h-10 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Welcome to ChatApp</h2>
          <p className="text-zinc-400 max-w-md">
            Select a channel from the sidebar to start chatting.
          </p>
        </div>
      </div>
    );
  }

  if (currentChannel.type === 'voice') {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 overflow-hidden">
          <VoiceChannelNotice
            currentChannel={currentChannel}
            isInCall={isInCall}
            activeVoiceChannelId={activeVoiceChannel?.id}
            voiceParticipants={voiceParticipants}
            voiceError={voiceError}
            requestJoinVoiceChannel={requestJoinVoiceChannel}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-hidden">
        <div className="relative flex flex-col h-full">
          <div className="absolute right-3 top-3 z-20">
            <button
              type="button"
              onClick={() => setIsHistoryPanelOpen((isOpen) => !isOpen)}
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs shadow-lg backdrop-blur transition-all ${
                isHistoryPanelOpen || activeHistoryDate
                  ? 'border-indigo-500/50 bg-indigo-500/20 text-indigo-100'
                  : 'border-zinc-700 bg-zinc-950/80 text-zinc-300 hover:bg-zinc-900'
              }`}
              title="消息记录"
            >
              <History className="h-4 w-4" />
              消息记录
            </button>
          </div>

          <HistoryPanel
            isOpen={isHistoryPanelOpen}
            currentChannelName={currentChannel.name}
            currentChannelId={currentChannel.id}
            historyDate={historyDate}
            setHistoryDate={setHistoryDate}
            activeHistoryDate={activeHistoryDate}
            pageSize={pageSize}
            setPageSize={setPageSize}
            fetchChannelMessages={fetchChannelMessages}
            openDayHistoryView={openDayHistoryView}
            clearHistoryDate={() => {
              clearHistoryDate();
              setIsHistoryPanelOpen(false);
            }}
            highlightMessageId={highlightMessageId}
            onClose={() => setIsHistoryPanelOpen(false)}
            historySenderOptions={historySenderOptions}
          />

          {isHistoryLoading && (
            <div className="absolute left-1/2 top-4 z-10 -translate-x-1/2 rounded-full border border-zinc-700 bg-zinc-950/90 px-3 py-1 text-xs text-zinc-300 shadow-lg">
              加载中...
            </div>
          )}

          {!isHistoryLoading && !hasMoreHistory && messages.length > 0 && (
            <div className="absolute left-1/2 top-4 z-10 -translate-x-1/2 rounded-full border border-zinc-700 bg-zinc-950/80 px-3 py-1 text-xs text-zinc-500">
              已到最早消息
            </div>
          )}

          {activeHistoryDate && (
            <div className="border-b border-amber-500/20 bg-amber-500/10 px-4 py-2 text-xs text-amber-200">
              正在查看 {activeHistoryDate} 的频道历史
            </div>
          )}

          <div
            ref={messageListRef}
            onScroll={syncViewport}
            onWheel={handleMessageWheel}
            className={`min-h-0 flex-1 overflow-y-auto p-4 space-y-4 transition-[padding] ${
              isHistoryPanelOpen ? 'xl:pr-[408px]' : ''
            }`}
          >
            {isLoading ? (
              <SkeletonMessageList count={6} />
            ) : messages.length > 0 ? (
              <>
                {isVirtualized && topPadding > 0 && <div style={{ height: topPadding }} aria-hidden="true" />}
                {visibleMessages.map(({ item: message }) => (
                  <div
                    key={message.id}
                    ref={(node) => {
                      if (node) {
                        messageRefs.current[message.id] = node;
                      } else {
                        delete messageRefs.current[message.id];
                      }
                    }}
                    className={`rounded-xl transition-all ${
                      highlightMessageId === message.id ? 'bg-indigo-500/10 ring-1 ring-indigo-400/50' : ''
                    }`}
                  >
                    <MessageBubble
                      message={message}
                      onRecall={onRecallMessage}
                      onMentionUser={mentionInput.insertMentionByUsername}
                      now={isMessageRecallable(message, recallNow) ? recallNow : undefined}
                    />
                  </div>
                ))}
                {isVirtualized && bottomPadding > 0 && (
                  <div style={{ height: bottomPadding }} aria-hidden="true" />
                )}
                <div ref={messagesEndRef} />
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-zinc-500">
                <svg className="w-16 h-16 mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <p className="text-lg font-medium">No messages yet</p>
                <p className="text-sm">Be the first to send a message!</p>
              </div>
            )}
          </div>

          <MessageComposer
            mentionInput={mentionInput}
            onSendMessage={onSendMessage}
            onBeforeSend={markShouldAutoScroll}
          />
        </div>
      </div>
    </div>
  );
};

export default MessageArea;
