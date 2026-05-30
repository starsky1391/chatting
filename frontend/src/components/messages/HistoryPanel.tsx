"use client";

import React, { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { CalendarDays, Clock3, History, Loader2, RotateCcw, Search, Users, X } from 'lucide-react';
import { config } from '@/lib/config';
import type { DisplayMessage, HistoryPreset, MentionMember } from './types';
import {
  buildHistorySnippet,
  formatDateKey,
  formatHistoryTime,
  getHistoryDayLabel,
  getRelativeDateKey,
  getWeekRange,
} from '@/hooks/useChannelMessages';

type HistoryPanelProps = {
  isOpen: boolean;
  currentChannelName?: string;
  currentChannelId?: number;
  historyDate: string;
  setHistoryDate: (value: string) => void;
  activeHistoryDate: string;
  pageSize: number;
  setPageSize: (value: number) => void;
  fetchChannelMessages: (options: {
    offset: number;
    limit: number;
    date?: string;
    startAt?: string;
    endAt?: string;
    query?: string;
    senderId?: string;
  }) => Promise<DisplayMessage[]>;
  openDayHistoryView: (date: string, messageId?: number) => Promise<void>;
  clearHistoryDate: () => void;
  highlightMessageId: number | null;
  onClose: () => void;
  historySenderOptions: MentionMember[];
};

const HistoryPanel: React.FC<HistoryPanelProps> = ({
  isOpen,
  currentChannelName,
  currentChannelId,
  historyDate,
  setHistoryDate,
  activeHistoryDate,
  pageSize,
  setPageSize,
  fetchChannelMessages,
  openDayHistoryView,
  clearHistoryDate,
  highlightMessageId,
  onClose,
  historySenderOptions,
}) => {
  const [historyPreset, setHistoryPreset] = useState<HistoryPreset>('all');
  const [historyQuery, setHistoryQuery] = useState('');
  const [historySenderId, setHistorySenderId] = useState('');
  const [historyResults, setHistoryResults] = useState<DisplayMessage[]>([]);
  const [historyOffset, setHistoryOffset] = useState(0);
  const [historyHasMore, setHistoryHasMore] = useState(true);
  const [historyLoadingMore, setHistoryLoadingMore] = useState(false);
  const [historySearching, setHistorySearching] = useState(false);
  const [historyError, setHistoryError] = useState('');

  const getHistoryFilterOptions = useCallback((override?: Partial<{ preset: HistoryPreset; date: string; query: string; senderId: string }>) => {
    const preset = override?.preset ?? historyPreset;
    const date = override?.date ?? historyDate;
    const query = override?.query ?? historyQuery;
    const senderId = override?.senderId ?? historySenderId;

    const options: {
      query?: string;
      senderId?: string;
      date?: string;
      startAt?: string;
      endAt?: string;
    } = {
      query,
      senderId,
    };

    if (preset === 'today') {
      options.date = getRelativeDateKey(0);
    } else if (preset === 'yesterday') {
      options.date = getRelativeDateKey(1);
    } else if (preset === 'week') {
      const range = getWeekRange();
      options.startAt = range.startAt;
      options.endAt = range.endAt;
    } else if (preset === 'custom' && date) {
      options.date = date;
    }

    return options;
  }, [historyDate, historyPreset, historyQuery, historySenderId]);

  const loadHistoryResults = useCallback(async (
    reset = true,
    override?: Partial<{ preset: HistoryPreset; date: string; query: string; senderId: string }>
  ) => {
    const offset = reset ? 0 : historyOffset;
    if (reset) {
      setHistorySearching(true);
    } else {
      setHistoryLoadingMore(true);
    }
    setHistoryError('');

    try {
      const nextMessages = await fetchChannelMessages({
        offset,
        limit: pageSize,
        ...getHistoryFilterOptions(override),
      });
      setHistoryResults((prev) => (reset ? nextMessages : [...prev, ...nextMessages]));
      setHistoryOffset(offset + nextMessages.length);
      setHistoryHasMore(nextMessages.length >= pageSize);
    } catch (error) {
      setHistoryError(error instanceof Error ? error.message : '加载消息记录失败');
      if (reset) {
        setHistoryResults([]);
        setHistoryOffset(0);
        setHistoryHasMore(false);
      }
    } finally {
      setHistorySearching(false);
      setHistoryLoadingMore(false);
    }
  }, [fetchChannelMessages, getHistoryFilterOptions, historyOffset, pageSize]);

  useEffect(() => {
    if (!isOpen) return;
    if (historyResults.length > 0 || historySearching) return;
    void loadHistoryResults(true);
  }, [historyResults.length, historySearching, isOpen, loadHistoryResults]);

  useEffect(() => {
    setHistoryPreset('all');
    setHistoryQuery('');
    setHistorySenderId('');
    setHistoryDate('');
    setHistoryResults([]);
    setHistoryOffset(0);
    setHistoryHasMore(true);
    setHistoryLoadingMore(false);
    setHistorySearching(false);
    setHistoryError('');
  }, [currentChannelId, setHistoryDate]);

  const applyHistorySearch = (event?: React.FormEvent) => {
    event?.preventDefault();
    void loadHistoryResults(true);
  };

  const applyHistoryPreset = (preset: HistoryPreset) => {
    setHistoryPreset(preset);
    const date = preset === 'custom' ? historyDate : '';
    if (preset !== 'custom') {
      setHistoryDate('');
    }
    void loadHistoryResults(true, { preset, date });
  };

  const resetHistorySearch = () => {
    setHistoryQuery('');
    setHistorySenderId('');
    setHistoryDate('');
    setHistoryPreset('all');
    void loadHistoryResults(true, { preset: 'all', date: '', query: '', senderId: '' });
  };

  const openHistoryResult = async (message: DisplayMessage) => {
    const dateKey = formatDateKey(message.createdAt);
    await openDayHistoryView(dateKey, message.id);
    onClose();
  };

  const showSearchLabel = historyQuery.trim() || historySenderId || historyPreset !== 'all';

  if (!isOpen) return null;

  return (
    <aside className="absolute inset-y-0 right-0 z-30 flex w-full max-w-[392px] flex-col border-l border-zinc-800 bg-[#101114]/95 text-zinc-200 shadow-2xl backdrop-blur">
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <History className="h-4 w-4 text-indigo-300" />
            消息记录
          </div>
          <p className="mt-0.5 text-xs text-zinc-500">
            {currentChannelName ? `# ${currentChannelName}` : '当前频道'}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-2 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
          aria-label="关闭消息记录"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <form onSubmit={applyHistorySearch} className="border-b border-zinc-800 p-3">
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              value={historyQuery}
              onChange={(event) => setHistoryQuery(event.target.value)}
              placeholder="搜索聊天记录"
              className="h-9 w-full rounded-lg border border-zinc-700 bg-zinc-950 pl-9 pr-3 text-sm text-white outline-none transition-all placeholder:text-zinc-600 focus:border-indigo-500"
            />
          </div>
          <button
            type="submit"
            disabled={historySearching}
            className="h-9 shrink-0 rounded-lg bg-indigo-500 px-3 text-sm font-medium text-white hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            搜索
          </button>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <label className="block text-xs text-zinc-500">
            <span className="mb-1 flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              成员
            </span>
            <select
              value={historySenderId}
              onChange={(event) => setHistorySenderId(event.target.value)}
              className="h-9 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 text-sm text-zinc-200 outline-none focus:border-indigo-500"
            >
              <option value="">全部成员</option>
              {historySenderOptions.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.username}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-xs text-zinc-500">
            <span className="mb-1 flex items-center gap-1">
              <RotateCcw className="h-3.5 w-3.5" />
              每页
            </span>
            <select
              value={pageSize}
              onChange={(event) => setPageSize(Number(event.target.value))}
              className="h-9 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 text-sm text-zinc-200 outline-none focus:border-indigo-500"
            >
              <option value={50}>50 条</option>
              <option value={100}>100 条</option>
              <option value={200}>200 条</option>
            </select>
          </label>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {([
            { key: 'all', label: '全部' },
            { key: 'today', label: '今天' },
            { key: 'yesterday', label: '昨天' },
            { key: 'week', label: '近7天' },
          ] as const).map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => applyHistoryPreset(item.key)}
              className={`rounded-md border px-2.5 py-1.5 text-xs transition-all ${
                historyPreset === item.key
                  ? 'border-indigo-500/50 bg-indigo-500/20 text-indigo-100'
                  : 'border-zinc-700 bg-zinc-950 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
              }`}
            >
              {item.label}
            </button>
          ))}
          <label className={`flex h-[31px] items-center gap-1 rounded-md border px-2 text-xs transition-all ${
            historyPreset === 'custom'
              ? 'border-indigo-500/50 bg-indigo-500/20 text-indigo-100'
              : 'border-zinc-700 bg-zinc-950 text-zinc-400'
          }`}>
            <CalendarDays className="h-3.5 w-3.5" />
            <input
              type="date"
              value={historyDate}
              onChange={(event) => {
                setHistoryPreset('custom');
                setHistoryDate(event.target.value);
              }}
              className="w-[112px] bg-transparent text-xs text-inherit outline-none"
            />
          </label>
        </div>

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={resetHistorySearch}
            className="flex-1 rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800"
          >
            重置
          </button>
          {activeHistoryDate && (
            <button
              type="button"
              onClick={clearHistoryDate}
              className="flex-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200 hover:bg-amber-500/20"
            >
              返回最新
            </button>
          )}
        </div>
      </form>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2">
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <Clock3 className="h-3.5 w-3.5" />
            {showSearchLabel ? '搜索结果' : '最近消息'}
          </div>
          <button
            type="button"
            onClick={() => void loadHistoryResults(true)}
            disabled={historySearching}
            className="rounded-md px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-50"
          >
            刷新
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
          {historySearching ? (
            <div className="flex h-full items-center justify-center text-sm text-zinc-500">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              正在读取消息记录
            </div>
          ) : historyError ? (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {historyError}
            </div>
          ) : historyResults.length > 0 ? (
            <div className="space-y-2">
              {historyResults.map((message, index) => {
                const dayKey = formatDateKey(message.createdAt);
                const prevDayKey = index > 0 ? formatDateKey(historyResults[index - 1].createdAt) : '';
                const showDayHeader = dayKey !== prevDayKey;
                const isHighlighted = highlightMessageId === message.id;
                const avatarUrl = message.sender.avatarUrl || '';
                return (
                  <React.Fragment key={message.id}>
                    {showDayHeader && (
                      <div className="sticky top-0 z-10 bg-[#101114]/95 py-1 text-center text-[11px] text-zinc-500">
                        {getHistoryDayLabel(dayKey)}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => void openHistoryResult(message)}
                      className={`flex w-full gap-2 rounded-lg border px-2 py-2 text-left transition-all ${
                        isHighlighted
                          ? 'border-indigo-400/60 bg-indigo-500/15'
                          : 'border-zinc-800 bg-zinc-950/60 hover:border-zinc-700 hover:bg-zinc-900'
                      }`}
                    >
                      <div className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md bg-indigo-500/20 text-xs font-semibold text-indigo-100">
                        {message.sender.avatarUrl ? (
                          <Image
                            src={config.api.imageUrl(avatarUrl)}
                            alt=""
                            fill
                            sizes="32px"
                            className="object-cover"
                          />
                        ) : (
                          message.sender.avatar || message.sender.username.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-medium text-zinc-100">{message.sender.username}</span>
                          <span className="shrink-0 text-[11px] text-zinc-500">{formatHistoryTime(message.createdAt)}</span>
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-zinc-400">
                          {buildHistorySnippet(message)}
                        </p>
                      </div>
                    </button>
                  </React.Fragment>
                );
              })}
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center text-center text-zinc-500">
              <History className="mb-3 h-10 w-10 opacity-40" />
              <p className="text-sm text-zinc-400">没有找到消息记录</p>
              <p className="mt-1 text-xs">换个关键词、成员或日期再试。</p>
            </div>
          )}
        </div>

        <div className="border-t border-zinc-800 p-3">
          <button
            type="button"
            onClick={() => void loadHistoryResults(false)}
            disabled={historyLoadingMore || historySearching || !historyHasMore}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-200 transition-all hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {historyLoadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
            {historyHasMore ? '查看更多记录' : '没有更多记录'}
          </button>
        </div>
      </div>
    </aside>
  );
};

export default HistoryPanel;
