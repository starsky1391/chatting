"use client";
import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { Room, RoomEvent, Participant, Track, createLocalAudioTrack } from 'livekit-client';
import { useChatStore } from '@/store/useChatStore';
import { useShallow } from 'zustand/react/shallow';
import { api } from '@/lib/api';
import { config } from '@/lib/config';
import { sendWebSocketMessage, onWebSocketMessage } from '@/lib/socket';

interface VoiceRoomProps {
  currentChannel: VoiceChannel | null;
}

type VoiceChannel = {
  id: number;
  name?: string;
  type: 'voice' | 'text';
  maxMembers?: number;
};

interface CallParticipant {
  userId: number;
  username: string;
  avatarUrl?: string;
}

interface ParticipantData {
  identity: string;
  name: string;
  avatarUrl?: string;
  isSpeaking: boolean;
  isMuted: boolean;
}

type CallStatusPayload = {
  channelId?: number;
  action?: 'join' | 'leave';
  userId: number;
  username?: string;
  avatarUrl?: string;
};

type ParticipantMetadata = {
  avatarUrl?: string;
};

export default function VoiceRoomLiveKit({ currentChannel }: VoiceRoomProps) {
  const { currentUser, isInCall, joinCall, leaveCall } = useChatStore(
    useShallow((state) => ({
      currentUser: state.currentUser,
      isInCall: state.isInCall,
      joinCall: state.joinCall,
      leaveCall: state.leaveCall,
    }))
  );
  const [participants, setParticipants] = useState<Map<string, ParticipantData>>(new Map());
  const [callParticipants, setCallParticipants] = useState<CallParticipant[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const roomRef = useRef<Room | null>(null);
  const localAudioTrackRef = useRef<Track | null>(null);

  // 获取 LiveKit Token
  const getToken = async (roomName: string): Promise<{ token: string; livekitUrl: string }> => {
    const response = await api.get<{ token: string; livekitUrl: string }>(
      `/api/livekit/token?room=${encodeURIComponent(roomName)}`
    );
    return response;
  };

  // 监听通话状态变化
  useEffect(() => {
    console.log('[Voice] Setting up call status listener for channel:', currentChannel?.id);
    
    const unsubscribe = onWebSocketMessage('voice:call-status', (rawData) => {
      const data = rawData as CallStatusPayload;
      console.log('[Voice] Call status update received:', data);
      if (data.channelId !== currentChannel?.id) {
        console.log('[Voice] Ignoring - channelId mismatch:', data.channelId, 'vs', currentChannel?.id);
        return;
      }

      setCallParticipants(prev => {
        if (data.action === 'join') {
          // 添加新参与者（避免重复）
          const exists = prev.some(p => p.userId === data.userId);
          if (exists) {
            console.log('[Voice] User already in list:', data.userId);
            return prev;
          }
          console.log('[Voice] Adding user to call:', data.userId, data.username);
          return [...prev, {
            userId: data.userId,
            username: data.username || 'Unknown',
            avatarUrl: data.avatarUrl,
          }];
        } else if (data.action === 'leave') {
          console.log('[Voice] Removing user from call:', data.userId);
          return prev.filter(p => p.userId !== data.userId);
        }
        return prev;
      });
    });

    return () => {
      unsubscribe();
    };
  }, [currentChannel?.id]);

  // 加入语音房间
  const handleJoinCall = async () => {
    if (!currentChannel || !currentUser) return;

    setIsConnecting(true);
    setError(null);

    try {
      // 1. 获取 Token
      const roomName = `channel-${currentChannel.id}`;
      const { token, livekitUrl } = await getToken(roomName);

      // 2. 创建 Room
      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
      });
      roomRef.current = room;

      // 3. 设置事件监听
      room.on(RoomEvent.ParticipantConnected, (participant: Participant) => {
        console.log('[LiveKit] Participant connected:', participant.identity);
        addParticipant(participant);
      });

      room.on(RoomEvent.ParticipantDisconnected, (participant: Participant) => {
        console.log('[LiveKit] Participant disconnected:', participant.identity);
        removeParticipant(participant.identity);
      });

      room.on(RoomEvent.ActiveSpeakersChanged, (speakers: Participant[]) => {
        updateSpeakingStatus(speakers);
      });

      // 监听远程参与者发布轨道
      room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
        console.log('[LiveKit] Track subscribed:', track.kind, 'from', participant.identity);
        if (track.kind === Track.Kind.Audio) {
          const audioElement = track.attach();
          audioElement.id = `audio-${participant.identity}`;
          audioElement.autoplay = true;
          document.body.appendChild(audioElement);
          console.log('[LiveKit] Audio element attached for', participant.identity, 'autoplay:', audioElement.autoplay);
        }
      });

      // 监听远程参与者取消发布轨道
      room.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
        console.log('[LiveKit] Track unsubscribed:', track.kind, 'from', participant.identity);
        if (track.kind === Track.Kind.Audio) {
          track.detach().forEach(element => element.remove());
        }
      });

      // 4. 连接到房间
      await room.connect(livekitUrl, token);
      console.log('[LiveKit] Connected to room:', roomName);

      // 5. 发布音频轨道
      const audioTrack = await createLocalAudioTrack();
      await room.localParticipant.publishTrack(audioTrack);
      localAudioTrackRef.current = audioTrack;

      // 6. 添加现有参与者并订阅其音频
      room.remoteParticipants.forEach((participant) => {
        addParticipant(participant);
        // 订阅现有参与者的音频轨道
        participant.audioTrackPublications.forEach((publication) => {
          if (publication.track) {
            console.log('[LiveKit] Subscribing to existing track from', participant.identity);
            const audioElement = publication.track.attach();
            audioElement.id = `audio-${participant.identity}`;
            audioElement.autoplay = true;
            document.body.appendChild(audioElement);
          }
        });
      });

      // 7. 添加自己到参与者列表
      setParticipants(prev => {
        const newMap = new Map(prev);
        newMap.set(currentUser.id.toString(), {
          identity: currentUser.id.toString(),
          name: currentUser.username || 'You',
          avatarUrl: currentUser.avatarUrl,
          isSpeaking: false,
          isMuted: false,
        });
        return newMap;
      });

      // 8. 通过 WebSocket 通知其他用户
      sendWebSocketMessage('voice:join', { channelId: currentChannel.id });

      joinCall();
      setIsConnecting(false);
    } catch (err) {
      console.error('[LiveKit] Failed to join:', err);
      setError(err instanceof Error ? err.message : '加入语音失败');
      setIsConnecting(false);
    }
  };

  // 离开语音房间
  const handleLeaveCall = async () => {
    // 通过 WebSocket 通知其他用户
    if (currentChannel) {
      sendWebSocketMessage('voice:leave', { channelId: currentChannel.id });
    }

    if (roomRef.current) {
      await roomRef.current.disconnect();
      roomRef.current = null;
    }
    if (localAudioTrackRef.current) {
      localAudioTrackRef.current.stop();
      localAudioTrackRef.current = null;
    }
    setParticipants(new Map());
    leaveCall();
  };

  // 静音切换
  const handleToggleMute = () => {
    if (roomRef.current && roomRef.current.localParticipant) {
      const newMuted = !isMuted;
      roomRef.current.localParticipant.setMicrophoneEnabled(!newMuted);
      setIsMuted(newMuted);
    }
  };

  // 辅助函数
  const addParticipant = (participant: Participant) => {
    setParticipants(prev => {
      const newMap = new Map(prev);
      newMap.set(participant.identity, {
        identity: participant.identity,
        name: participant.name || participant.identity,
        avatarUrl: participant.metadata ? (JSON.parse(participant.metadata) as ParticipantMetadata).avatarUrl : undefined,
        isSpeaking: false,
        isMuted: false,
      });
      return newMap;
    });
  };

  const removeParticipant = (identity: string) => {
    setParticipants(prev => {
      const newMap = new Map(prev);
      newMap.delete(identity);
      return newMap;
    });
  };

  const updateSpeakingStatus = (speakers: Participant[]) => {
    const speakingIds = new Set(speakers.map(s => s.identity));
    setParticipants(prev => {
      const newMap = new Map(prev);
      prev.forEach((data, id) => {
        newMap.set(id, { ...data, isSpeaking: speakingIds.has(id) });
      });
      return newMap;
    });
  };

  // 清理
  useEffect(() => {
    return () => {
      if (roomRef.current && currentChannel) {
        sendWebSocketMessage('voice:leave', { channelId: currentChannel.id });
      }
      handleLeaveCall();
    };
    // Cleanup only on unmount; call state is managed by explicit join/leave actions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col h-full bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            </svg>
          </div>
          <div>
            <h3 className="text-white font-semibold">{currentChannel?.name}</h3>
            <p className="text-xs text-gray-400">
              {isInCall ? `${participants.size} 人通话中` : `${callParticipants.length} 人通话中`}
            </p>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 bg-red-500/10 border-b border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Participants */}
      <div className="flex-1 overflow-y-auto p-4">
        {!isInCall && callParticipants.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <svg className="w-16 h-16 mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            </svg>
            <p className="text-lg font-medium">暂无通话</p>
            <p className="text-sm">点击下方按钮加入语音</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {(isInCall ? Array.from(participants.values()) : callParticipants).map((p) => {
              const key = isInCall ? (p as ParticipantData).identity : (p as CallParticipant).userId;
              const name = isInCall ? (p as ParticipantData).name : (p as CallParticipant).username;
              const avatarUrl = p.avatarUrl;
              const isSpeaking = isInCall && 'isSpeaking' in p && p.isSpeaking;
              const isMuted = isInCall && 'isMuted' in p && p.isMuted;
              
              return (
                <div
                  key={key}
                  className={`p-3 rounded-lg border ${
                    isSpeaking
                      ? 'bg-green-500/10 border-green-500/30'
                      : 'bg-gray-800 border-gray-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className="relative w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white text-sm overflow-hidden">
                      {avatarUrl ? (
                        <Image
                          src={config.api.avatarThumbUrl(avatarUrl, 32)}
                          alt=""
                          fill
                          sizes="32px"
                          className="object-cover"
                          unoptimized
                        />
                      ) : (
                        (name || '?').charAt(0).toUpperCase()
                      )}
                    </div>
                    <div>
                      <p className="text-white text-sm font-medium">{name}</p>
                      <p className="text-xs text-gray-400">
                        {isInCall
                          ? (isSpeaking ? '正在说话...' : isMuted ? '已静音' : '在线')
                          : '通话中'
                        }
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="p-4 border-t border-gray-700">
        <div className="flex items-center justify-center gap-4">
          {!isInCall ? (
            <button
              onClick={handleJoinCall}
              disabled={isConnecting}
              className="px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium disabled:opacity-50"
            >
              {isConnecting ? '连接中...' : '加入语音'}
            </button>
          ) : (
            <>
              <button
                onClick={handleToggleMute}
                className={`p-4 rounded-full ${
                  isMuted ? 'bg-red-500' : 'bg-gray-700'
                } hover:opacity-80`}
              >
                {isMuted ? (
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                )}
              </button>
              <button
                onClick={handleLeaveCall}
                className="p-4 rounded-full bg-red-500 hover:bg-red-600"
              >
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
