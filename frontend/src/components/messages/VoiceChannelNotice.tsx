"use client";

import React, { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { api } from '@/lib/api';
import { onWebSocketMessage } from '@/lib/socket';
import type { CallParticipant, Channel } from './types';

type VoiceChannelNoticeProps = {
  currentChannel: Channel;
  isInCall: boolean;
  activeVoiceChannelId?: number | null;
  voiceParticipants: Array<{
    identity: string;
    name: string;
    avatarUrl?: string;
    isSpeaking: boolean;
    isMuted: boolean;
  }>;
  voiceError: string | null;
  requestJoinVoiceChannel: (channel: Channel & { name: string }) => void;
};

const VoiceChannelNotice: React.FC<VoiceChannelNoticeProps> = ({
  currentChannel,
  isInCall,
  activeVoiceChannelId,
  voiceParticipants,
  voiceError,
  requestJoinVoiceChannel,
}) => {
  const [callParticipants, setCallParticipants] = useState<CallParticipant[]>([]);
  const isVoiceChannel = currentChannel.type === 'voice' && Boolean(currentChannel.id);
  const activeCallCount = useMemo(() => {
    if (isInCall && activeVoiceChannelId === currentChannel.id) {
      return voiceParticipants.length || 1;
    }
    return callParticipants.length;
  }, [activeVoiceChannelId, callParticipants.length, currentChannel.id, isInCall, voiceParticipants.length]);

  useEffect(() => {
    if (!isVoiceChannel) {
      return;
    }

    let cancelled = false;
    const channelId = currentChannel.id;

    const loadParticipants = async () => {
      try {
        const data = await api.get<Array<{ userId?: number; id?: number; username?: string; avatarUrl?: string }>>(`/api/voice/${channelId}/participants`);
        if (cancelled) return;
        const participants = Array.isArray(data) ? data : [];
        setCallParticipants(participants.map((participant) => ({
          userId: participant.userId ?? participant.id ?? 0,
          username: participant.username || 'Unknown',
          avatarUrl: participant.avatarUrl || '',
        })).filter((participant) => participant.userId > 0));
      } catch {
        if (!cancelled) {
          setCallParticipants([]);
        }
      }
    };

    void loadParticipants();

    const unsubscribe = onWebSocketMessage('voice:call-status', (rawData) => {
      const data = rawData as {
        channelId?: number;
        action?: 'join' | 'leave';
        userId?: number;
        username?: string;
        avatarUrl?: string;
      };

      const userId = data.userId;
      if (data.channelId !== channelId || typeof userId !== 'number') return;

      setCallParticipants((prev) => {
        if (data.action === 'join') {
          if (prev.some((participant) => participant.userId === userId)) return prev;
          return [...prev, {
            userId,
            username: data.username || 'Unknown',
            avatarUrl: data.avatarUrl || '',
          }];
        }

        if (data.action === 'leave') {
          return prev.filter((participant) => participant.userId !== userId);
        }

        return prev;
      });
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [currentChannel.id, isVoiceChannel]);

  return (
    <div className="flex h-full flex-col bg-gray-900">
      <div className="flex items-center justify-between border-b border-gray-700 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500 text-white">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-white">{currentChannel.name}</h3>
            <p className="text-xs text-gray-400">
              {currentChannel.type === 'voice'
                ? `${activeCallCount} 人通话中`
                : '选择左下角语音控件加入，切换页面不会断开'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => requestJoinVoiceChannel({ ...currentChannel, name: currentChannel.name || '语音频道' })}
          disabled={isInCall && activeVoiceChannelId === currentChannel.id}
          className="rounded-lg bg-green-500 px-4 py-2 text-sm font-medium text-white hover:bg-green-600 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
        >
          {isInCall && activeVoiceChannelId === currentChannel.id
            ? '已在语音中'
            : '加入语音'}
        </button>
      </div>

      {voiceError && (
        <div className="border-b border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {voiceError}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {isInCall && activeVoiceChannelId === currentChannel.id ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
            {voiceParticipants.map((participant) => (
              <div
                key={participant.identity}
                className={`rounded-lg border p-3 ${
                  participant.isSpeaking
                    ? 'border-green-500/40 bg-green-500/10'
                    : 'border-gray-700 bg-gray-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-indigo-500 text-sm font-semibold text-white">
                    {participant.avatarUrl ? (
                      <Image
                        src={participant.avatarUrl}
                        alt=""
                        fill
                        unoptimized
                        sizes="40px"
                        className="object-cover"
                      />
                    ) : (
                      participant.name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">{participant.name}</p>
                    <p className="text-xs text-gray-400">
                      {participant.isSpeaking ? '正在说话' : participant.isMuted ? '已静音' : '在线'}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : callParticipants.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
            {callParticipants.map((participant) => (
              <div
                key={participant.userId}
                className="rounded-lg border border-gray-700 bg-gray-800 p-3"
              >
                <div className="flex items-center gap-3">
                  <div className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-indigo-500 text-sm font-semibold text-white">
                    {participant.avatarUrl ? (
                      <Image
                        src={participant.avatarUrl}
                        alt=""
                        fill
                        unoptimized
                        sizes="40px"
                        className="object-cover"
                      />
                    ) : (
                      participant.username.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">{participant.username}</p>
                    <p className="text-xs text-gray-400">通话中</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-center text-gray-400">
            <svg className="mb-4 h-16 w-16 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            </svg>
            <p className="text-lg font-medium">暂无通话</p>
            <p className="mt-1 text-sm">当前语音频道里还没人。</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default VoiceChannelNotice;
