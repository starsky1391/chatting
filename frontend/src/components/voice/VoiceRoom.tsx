"use client";
/* eslint-disable @next/next/no-img-element */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useChatStore } from '@/store/useChatStore';
import { config } from '@/lib/config';
import {
  onWebSocketMessage,
  sendWebSocketMessage
} from '@/lib/socket';

interface VoiceRoomProps {
  currentChannel: VoiceChannel | null;
  onBack: () => void;
}

type VoiceChannel = {
  id: number;
  name?: string;
  type: 'voice' | 'text';
};

interface VoiceParticipant {
  userId: number;
  username: string;
  avatarUrl: string;
  isSpeaking: boolean;
  stream?: MediaStream;
}

type BrowserWindow = Window & typeof globalThis & {
  webkitAudioContext?: typeof AudioContext;
};

type VoiceParticipantPayload = {
  userId: number;
  username?: string;
  avatarUrl?: string;
};

type VoiceParticipantsPayload = {
  participants?: VoiceParticipantPayload[];
};

type VoiceUserPayload = VoiceParticipantPayload;

type VoiceSignalPayload = {
  senderId?: number;
  targetUserId?: number;
  signalType?: string;
  type?: string;
  username?: string;
  avatarUrl?: string;
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
};

const VoiceRoom: React.FC<VoiceRoomProps> = ({ currentChannel }) => {
  const { currentUser, isInCall, joinCall, leaveCall, setLocalStream } = useChatStore();

  const [participants, setParticipants] = useState<Map<number, VoiceParticipant>>(new Map());
  const [isMuted, setIsMuted] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnections = useRef<Map<number, RTCPeerConnection>>(new Map());
  const audioElementsRef = useRef<Map<number, HTMLAudioElement>>(new Map());
  const speakingCheckIntervals = useRef<Map<number, NodeJS.Timeout>>(new Map());
  const analyserNodes = useRef<Map<number, AnalyserNode>>(new Map());
  const pendingIceCandidates = useRef<Map<number, RTCIceCandidateInit[]>>(new Map());
  const joinedRef = useRef(false);

  // Setup speaking detection for a participant
  const setupSpeakingDetection = useCallback((userId: number, stream: MediaStream) => {
    try {
      // Stop any existing check
      const existingInterval = speakingCheckIntervals.current.get(userId);
      if (existingInterval) {
        clearInterval(existingInterval);
      }

      const AudioContextClass = window.AudioContext || (window as BrowserWindow).webkitAudioContext;
      if (!AudioContextClass) return;
      const audioContext = new AudioContextClass();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      analyserNodes.current.set(userId, analyser);

      // Check speaking status every 100ms
      const interval = setInterval(() => {
        const currentAnalyser = analyserNodes.current.get(userId);
        if (!currentAnalyser) return;

        try {
          const dataArray = new Uint8Array(currentAnalyser.frequencyBinCount);
          currentAnalyser.getByteTimeDomainData(dataArray);

          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            const value = (dataArray[i] - 128) / 128;
            sum += value * value;
          }
          const rms = Math.sqrt(sum / dataArray.length);

          const isSpeaking = rms > 0.02;

          setParticipants(prev => {
            const newMap = new Map(prev);
            const participant = newMap.get(userId);
            if (participant && participant.isSpeaking !== isSpeaking) {
              newMap.set(userId, { ...participant, isSpeaking });
            }
            return newMap;
          });
        } catch {
          // Ignore errors during analysis
        }
      }, 100);

      speakingCheckIntervals.current.set(userId, interval);
    } catch (error) {
      console.error('Failed to setup speaking detection:', error);
    }
  }, []);

  // Cleanup speaking detection
  const cleanupSpeakingDetection = useCallback((userId: number) => {
    const interval = speakingCheckIntervals.current.get(userId);
    if (interval) {
      clearInterval(interval);
      speakingCheckIntervals.current.delete(userId);
    }
    analyserNodes.current.delete(userId);
  }, []);

  // Initialize WebRTC peer connection
  const createPeerConnection = useCallback((userId: number): RTCPeerConnection => {
    const pc = new RTCPeerConnection({
      iceServers: config.webrtc.iceServers
    });

    pc.ontrack = (event) => {
      if (event.streams && event.streams.length > 0) {
        const stream = event.streams[0];

        // Update participant with stream
        setParticipants(prev => {
          const newMap = new Map(prev);
          const participant = newMap.get(userId);
          if (participant) {
            newMap.set(userId, { ...participant, stream });
          }
          return newMap;
        });

        // Play audio
        const audio = audioElementsRef.current.get(userId);
        if (audio) {
          audio.srcObject = stream;
          audio.play().catch(() => {});
        }

        // Setup speaking detection
        setupSpeakingDetection(userId, stream);
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendWebSocketMessage('voice:signal', {
          channelId: currentChannel?.id,
          signalType: 'ice-candidate',
          candidate: event.candidate,
          targetUserId: userId
        });
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`[Voice] ICE state with user ${userId}:`, pc.iceConnectionState);
      if (pc.iceConnectionState === 'failed') {
        console.warn(`[Voice] ICE failed with user ${userId}. 跨网络通话需要 TURN 服务器,请配置 NEXT_PUBLIC_TURN_URL/USERNAME/CREDENTIAL。`);
        // 触发 ICE 重启
        try {
          pc.restartIce();
        } catch {}
      }
    };

    peerConnections.current.set(userId, pc);
    return pc;
  }, [currentChannel, setupSpeakingDetection]);

  // Helper: 创建 pc 并把本地音轨加入
  const createPeerWithTracks = useCallback((userId: number): RTCPeerConnection => {
    const pc = createPeerConnection(userId);
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }
    return pc;
  }, [createPeerConnection]);

  // Helper: 给某个用户发起 offer
  const sendOfferTo = useCallback(async (userId: number) => {
    if (!currentChannel) return;
    console.log('[Voice] sendOfferTo:', userId);
    const pc = createPeerWithTracks(userId);
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      console.log('[Voice] sending offer to', userId, offer.type);
      sendWebSocketMessage('voice:signal', {
        channelId: currentChannel.id,
        signalType: 'offer',
        offer,
        targetUserId: userId
      });
    } catch (e) {
      console.error('[Voice] sendOfferTo failed:', e);
    }
  }, [currentChannel, createPeerWithTracks]);

  // Join voice call
  const handleJoinCall = useCallback(async () => {
    if (!currentChannel || currentChannel.type !== 'voice' || !currentUser) return;
    if (joinedRef.current) return; // 防止 StrictMode 重复
    joinedRef.current = true;

    setIsConnecting(true);

    try {
      // Check if mediaDevices is available (requires HTTPS)
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('语音通话需要 HTTPS 安全连接。请使用 HTTPS 访问网站。');
        setIsConnecting(false);
        joinedRef.current = false;
        return;
      }

      // Get local audio stream
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      localStreamRef.current = stream;
      setLocalStream(stream);

      // Add self to participants
      setParticipants(prev => {
        const newMap = new Map(prev);
        newMap.set(currentUser.id, {
          userId: currentUser.id,
          username: currentUser.username || 'You',
          avatarUrl: currentUser.avatarUrl || '',
          isSpeaking: false,
          stream
        });
        return newMap;
      });

      // Setup speaking detection for self
      setupSpeakingDetection(currentUser.id, stream);

      // Join voice channel via WebSocket
      sendWebSocketMessage('voice:join', {
        channelId: currentChannel.id,
        userId: currentUser.id
      });

      joinCall();
      setIsConnecting(false);
    } catch (error) {
      console.error('Failed to join voice call:', error);
      joinedRef.current = false;
      setIsConnecting(false);
    }
  }, [currentChannel, currentUser, joinCall, setLocalStream, setupSpeakingDetection]);

  // Leave voice call
  const handleLeaveCall = useCallback(() => {
    if (!currentChannel || !currentUser) return;

    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }

    // Close all peer connections
    peerConnections.current.forEach((pc, userId) => {
      pc.close();
      cleanupSpeakingDetection(userId);
    });
    peerConnections.current.clear();
    pendingIceCandidates.current.clear();
    joinedRef.current = false;

    // Leave voice channel via WebSocket
    sendWebSocketMessage('voice:leave', {
      channelId: currentChannel.id,
      userId: currentUser.id
    });

    setParticipants(new Map());
    leaveCall();
  }, [currentChannel, currentUser, leaveCall, cleanupSpeakingDetection]);

  // Toggle mute
  const handleToggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const newMuted = !isMuted;
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !newMuted;
      });
      setIsMuted(newMuted);
    }
  }, [isMuted]);

  // Auto-join when entering voice channel
  useEffect(() => {
    if (currentChannel && currentChannel.type === 'voice' && !isInCall && !isConnecting) {
      queueMicrotask(() => {
        void handleJoinCall();
      });
    }

    return () => {
      if (isInCall) {
        handleLeaveCall();
      }
    };
  }, [currentChannel, handleJoinCall, handleLeaveCall, isConnecting, isInCall]);

  // WebSocket event handlers
  useEffect(() => {
    if (!currentChannel || currentChannel.type !== 'voice') return;

    const handleVoiceParticipants = async (rawData: unknown) => {
      const data = rawData as VoiceParticipantsPayload;
      if (!currentUser || !Array.isArray(data.participants)) return;
      console.log('[Voice] participants list:', data.participants.length, data.participants);
      // 把房间已有的人都加入参与者列表,并主动发 offer
      for (const p of data.participants) {
        if (p.userId === currentUser.id) continue;
        setParticipants(prev => {
          if (prev.has(p.userId)) return prev;
          const newMap = new Map(prev);
          newMap.set(p.userId, {
            userId: p.userId,
            username: p.username || 'Unknown',
            avatarUrl: p.avatarUrl || '',
            isSpeaking: false
          });
          return newMap;
        });
        await sendOfferTo(p.userId);
      }
    };

    const handleVoiceUserJoined = async (rawData: unknown) => {
      const data = rawData as VoiceUserPayload;
      if (!currentUser || data.userId === currentUser.id) return;
      console.log('[Voice] user-joined:', data.userId, data.username);

      // 只把新人加入参与者列表(等新人给自己发 offer)
      setParticipants(prev => {
        const newMap = new Map(prev);
        newMap.set(data.userId, {
          userId: data.userId,
          username: data.username || 'Unknown',
          avatarUrl: data.avatarUrl || '',
          isSpeaking: false
        });
        return newMap;
      });
    };

    const handleVoiceUserLeft = (rawData: unknown) => {
      const data = rawData as VoiceUserPayload;
      if (data.userId) {
        // Remove participant
        setParticipants(prev => {
          const newMap = new Map(prev);
          newMap.delete(data.userId);
          return newMap;
        });

        // Cleanup peer connection
        const pc = peerConnections.current.get(data.userId);
        if (pc) {
          pc.close();
          peerConnections.current.delete(data.userId);
        }
        pendingIceCandidates.current.delete(data.userId);
        cleanupSpeakingDetection(data.userId);
      }
    };

    const handleVoiceSignal = async (rawData: unknown) => {
      const data = rawData as VoiceSignalPayload;
      if (!currentUser || !data.senderId) return;
      const senderId = data.senderId;
      // 只处理发给自己的信令
      if (data.targetUserId && data.targetUserId !== currentUser.id) return;
      if (senderId === currentUser.id) return;

      try {
        let pc = peerConnections.current.get(senderId);
        const sigType = data.signalType || data.type;

        if (sigType === 'offer') {
          // 收到 offer:确保参与者条目存在
          setParticipants(prev => {
            if (prev.has(senderId)) return prev;
            const newMap = new Map(prev);
            newMap.set(senderId, {
              userId: senderId,
              username: data.username || 'Unknown',
              avatarUrl: data.avatarUrl || '',
              isSpeaking: false
            });
            return newMap;
          });

          // 如已有旧连接,先关掉
          if (pc) {
            pc.close();
            peerConnections.current.delete(senderId);
          }
          pc = createPeerWithTracks(senderId);

          if (!data.offer) return;
          await pc.setRemoteDescription(new RTCSessionDescription(data.offer));

          // 应用所有缓冲的 ICE candidates
          const pending = pendingIceCandidates.current.get(senderId);
          if (pending) {
            for (const c of pending) {
              try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch {}
            }
            pendingIceCandidates.current.delete(senderId);
          }

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          sendWebSocketMessage('voice:signal', {
            channelId: currentChannel.id,
            signalType: 'answer',
            answer,
            targetUserId: senderId
          });
        } else if (sigType === 'answer' && pc) {
          if (pc.signalingState === 'have-local-offer') {
            if (!data.answer) return;
            await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
            const pending = pendingIceCandidates.current.get(senderId);
            if (pending) {
              for (const c of pending) {
                try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch {}
              }
              pendingIceCandidates.current.delete(senderId);
            }
          }
        } else if (sigType === 'ice-candidate') {
          if (pc && pc.remoteDescription) {
            if (!data.candidate) return;
            await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
          } else {
            // 远端描述还没设置,先缓冲
            const arr = pendingIceCandidates.current.get(senderId) || [];
            if (!data.candidate) return;
            arr.push(data.candidate);
            pendingIceCandidates.current.set(senderId, arr);
          }
        }
      } catch (error) {
        console.error('Error handling voice signal:', error);
      }
    };

    const unsubParticipants = onWebSocketMessage('voice:participants', handleVoiceParticipants);
    const unsubJoined = onWebSocketMessage('voice:user-joined', handleVoiceUserJoined);
    const unsubLeft = onWebSocketMessage('voice:user-left', handleVoiceUserLeft);
    const unsubSignal = onWebSocketMessage('voice:signal', handleVoiceSignal);

    return () => {
      unsubParticipants();
      unsubJoined();
      unsubLeft();
      unsubSignal();
    };
  }, [currentChannel, currentUser, createPeerWithTracks, sendOfferTo, cleanupSpeakingDetection]);

  // Render participant tile
  const renderParticipant = (participant: VoiceParticipant) => {
    const isSelf = participant.userId === currentUser?.id;

    return (
      <div
        key={participant.userId}
        className={`
          relative w-24 h-24 rounded-xl overflow-hidden transition-all duration-200
          ${participant.isSpeaking
            ? 'ring-4 ring-green-500 shadow-lg shadow-green-500/30'
            : 'ring-2 ring-zinc-700'
          }
          ${isSelf && !participant.isSpeaking ? 'ring-indigo-500' : ''}
        `}
      >
        {/* Hidden audio element for remote streams */}
        {!isSelf && (
          <audio
            ref={(el) => {
              if (el) {
                audioElementsRef.current.set(participant.userId, el);
                if (participant.stream) {
                  el.srcObject = participant.stream;
                  el.play().catch(() => {});
                }
              }
            }}
            autoPlay
            className="hidden"
          />
        )}

        {/* Avatar */}
        <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
          {participant.avatarUrl ? (
            <img
              src={`${config.api.baseUrl}${participant.avatarUrl}`}
              alt={participant.username}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-3xl font-bold text-zinc-400">
              {participant.username?.charAt(0)?.toUpperCase() || '?'}
            </span>
          )}
        </div>

        {/* Username overlay */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1">
          <p className="text-xs text-white truncate text-center">
            {isSelf ? 'You' : participant.username}
          </p>
        </div>

        {/* Muted indicator */}
        {isSelf && isMuted && (
          <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
            </svg>
          </div>
        )}

        {/* Speaking indicator */}
        {participant.isSpeaking && (
          <div className="absolute top-1 left-1 w-3 h-3 rounded-full bg-green-500 animate-pulse" />
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Participants Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {participants.size > 0 ? (
          <div className="grid grid-cols-4 gap-3">
            {Array.from(participants.values()).map(renderParticipant)}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-zinc-500">
            <div className="text-4xl mb-4">🎤</div>
            <h3 className="text-lg font-medium mb-2">语音频道</h3>
            <p className="text-center max-w-md">
              {isConnecting ? '正在连接...' : '准备加入通话...'}
            </p>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="p-4 border-t border-zinc-700 bg-zinc-800/50">
        {isInCall ? (
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={handleToggleMute}
              className={`
                p-3 rounded-full transition-all transform hover:scale-105
                ${isMuted
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-zinc-700 hover:bg-zinc-600'
                }
              `}
              title={isMuted ? '取消静音' : '静音'}
            >
              {isMuted ? '🔇' : '🎤'}
            </button>

            <button
              onClick={handleLeaveCall}
              className="px-6 py-3 bg-red-600 hover:bg-red-700 rounded-lg font-medium transition-all transform hover:scale-105"
            >
              离开通话
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-center">
            <button
              onClick={handleJoinCall}
              disabled={isConnecting}
              className={`
                px-6 py-3 bg-green-600 hover:bg-green-700 rounded-lg font-medium transition-all transform hover:scale-105
                ${isConnecting ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              {isConnecting ? '连接中...' : '📞 加入通话'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default VoiceRoom;
