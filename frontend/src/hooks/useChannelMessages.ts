import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import type { ApiMessage, Channel, DisplayMessage } from '@/components/messages/types';

type UseChannelMessagesOptions = {
  currentChannel: Channel | null;
  currentUserId: number;
  messages: DisplayMessage[];
  setMessages: (messages: DisplayMessage[]) => void;
};

type FetchOptions = {
  offset: number;
  limit: number;
  date?: string;
  startAt?: string;
  endAt?: string;
  query?: string;
  senderId?: string;
};

export function formatDateKey(value: string | Date) {
  const date = typeof value === 'string' ? new Date(value) : value;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getRelativeDateKey(daysAgo: number) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return formatDateKey(date);
}

export function getHistoryDayLabel(dateKey: string) {
  if (dateKey === getRelativeDateKey(0)) return '今天';
  if (dateKey === getRelativeDateKey(1)) return '昨天';
  return dateKey;
}

export function formatHistoryTime(value: string | Date) {
  const date = typeof value === 'string' ? new Date(value) : value;
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function buildHistorySnippet(message: DisplayMessage) {
  const body = message.content.body || '';
  const normalized = body.startsWith('image:') || body.startsWith('/uploads/')
    ? '[图片]'
    : body.replace(/\s+/g, ' ').trim();
  if (normalized.length <= 96) return normalized || '[空消息]';
  return `${normalized.slice(0, 96)}...`;
}

function getDateRange(date: string) {
  const start = new Date(`${date}T00:00:00`);
  const end = new Date(start);
  end.setDate(start.getDate() + 1);
  return {
    startAt: start.toISOString(),
    endAt: end.toISOString(),
  };
}

function mapMessages(items: ApiMessage[], currentUserId: number) {
  return items.map<DisplayMessage>((message) => ({
    ...message,
    sender: {
      id: message.sender?.id || 0,
      username: message.sender?.username || 'Unknown',
      avatar: message.sender?.avatar || '',
      avatarUrl: message.sender?.avatarUrl || '',
      role: (message.sender?.role as 'admin' | 'moderator' | 'member') || 'member',
      groupRole: message.sender?.groupRole || '',
      email: '',
      isOnline: true,
    },
    isOwn: message.sender?.id === currentUserId,
  }));
}

export function getWeekRange() {
  const start = new Date();
  start.setDate(start.getDate() - 6);
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setDate(end.getDate() + 1);
  end.setHours(0, 0, 0, 0);
  return {
    startAt: start.toISOString(),
    endAt: end.toISOString(),
  };
}

export function useChannelMessages({
  currentChannel,
  currentUserId,
  messages,
  setMessages,
}: UseChannelMessagesOptions) {
  const [pageSize, setPageSize] = useState(50);
  const [historyDate, setHistoryDate] = useState('');
  const [activeHistoryDate, setActiveHistoryDate] = useState('');
  const [highlightMessageId, setHighlightMessageId] = useState<number | null>(null);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [hasMoreHistory, setHasMoreHistory] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageListRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const shouldAutoScrollRef = useRef(true);
  const pendingScrollRestoreRef = useRef<{ scrollHeight: number; scrollTop: number } | null>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const fetchChannelMessages = useCallback(async (options: FetchOptions) => {
    if (!currentChannel) return [];

    const params = new URLSearchParams({
      limit: String(options.limit),
      offset: String(options.offset),
    });
    if (options.date) {
      params.set('date', options.date);
      const range = getDateRange(options.date);
      params.set('startAt', range.startAt);
      params.set('endAt', range.endAt);
    }
    if (options.startAt && options.endAt) {
      params.set('startAt', options.startAt);
      params.set('endAt', options.endAt);
    }
    if (options.query?.trim()) {
      params.set('q', options.query.trim());
    }
    if (options.senderId) {
      params.set('senderId', options.senderId);
    }

    const items = await api.get<ApiMessage[]>(`/api/channels/${currentChannel.id}/messages?${params.toString()}`);
    return mapMessages(items, currentUserId);
  }, [currentChannel, currentUserId]);

  const reloadLatestMessages = useCallback(async (date = activeHistoryDate) => {
    if (!currentChannel || currentChannel.type !== 'text') return;
    setIsHistoryLoading(true);
    shouldAutoScrollRef.current = !date;
    try {
      const nextMessages = await fetchChannelMessages({ offset: 0, limit: pageSize, date });
      setMessages(nextMessages);
      setHasMoreHistory(nextMessages.length >= pageSize);
      setActiveHistoryDate(date);
    } catch (error) {
      console.error(error);
    } finally {
      setIsHistoryLoading(false);
    }
  }, [activeHistoryDate, currentChannel, fetchChannelMessages, pageSize, setMessages]);

  const openDayHistoryView = useCallback(async (date: string, messageId?: number) => {
    if (!date) return;
    setHistoryDate(date);
    if (messageId) {
      setHighlightMessageId(messageId);
    }
    await reloadLatestMessages(date);
  }, [reloadLatestMessages]);

  const clearHistoryDate = useCallback(() => {
    setHistoryDate('');
    void reloadLatestMessages('');
  }, [reloadLatestMessages]);

  const loadOlderMessages = useCallback(async () => {
    if (!currentChannel || currentChannel.type !== 'text' || isHistoryLoading || !hasMoreHistory) return;
    const list = messageListRef.current;
    setIsHistoryLoading(true);
    shouldAutoScrollRef.current = false;
    try {
      if (list) {
        pendingScrollRestoreRef.current = {
          scrollHeight: list.scrollHeight,
          scrollTop: list.scrollTop,
        };
      }
      const olderMessages = await fetchChannelMessages({
        offset: messages.length,
        limit: pageSize,
        date: activeHistoryDate,
      });
      setMessages([...olderMessages, ...messages]);
      setHasMoreHistory(olderMessages.length >= pageSize);
    } catch (error) {
      console.error(error);
    } finally {
      setIsHistoryLoading(false);
    }
  }, [activeHistoryDate, currentChannel, fetchChannelMessages, hasMoreHistory, isHistoryLoading, messages, pageSize, setMessages]);

  const handleMessageWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    if (event.deltaY >= 0 || isHistoryLoading || !hasMoreHistory) return;
    const list = event.currentTarget;
    if (list.scrollTop > 8) return;
    event.preventDefault();
    void loadOlderMessages();
  }, [hasMoreHistory, isHistoryLoading, loadOlderMessages]);

  useEffect(() => {
    if (shouldAutoScrollRef.current) {
      scrollToBottom();
    }
  }, [messages, scrollToBottom]);

  useLayoutEffect(() => {
    const pending = pendingScrollRestoreRef.current;
    const list = messageListRef.current;
    if (!pending || !list) return;

    list.scrollTop = list.scrollHeight - pending.scrollHeight + pending.scrollTop;
    pendingScrollRestoreRef.current = null;
  }, [messages]);

  useEffect(() => {
    if (!highlightMessageId) return;
    const target = messageRefs.current[highlightMessageId];
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const timer = window.setTimeout(() => setHighlightMessageId(null), 2600);
    return () => window.clearTimeout(timer);
  }, [highlightMessageId, messages]);

  useEffect(() => {
    shouldAutoScrollRef.current = true;
    setHistoryDate('');
    setActiveHistoryDate('');
    setHighlightMessageId(null);
    setHasMoreHistory(true);
    Object.keys(messageRefs.current).forEach((key) => {
      delete messageRefs.current[Number(key)];
    });
  }, [currentChannel?.id]);

  const markShouldAutoScroll = useCallback(() => {
    shouldAutoScrollRef.current = true;
  }, []);

  return {
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
  };
}
