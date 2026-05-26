"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Headphones, Loader2, Mic, MicOff, PhoneOff, Radio, Volume2 } from 'lucide-react';
import { LocalAudioTrack, Participant, Room, RoomEvent, Track } from 'livekit-client';
import { api } from '@/lib/api';
import { connectWebSocket, onWebSocketMessage, sendWebSocketMessage } from '@/lib/socket';
import { useChatStore } from '@/store/useChatStore';

type VoiceChannel = {
  id: number;
  name: string;
  type: 'text' | 'voice';
  groupId?: number;
  maxMembers?: number;
};

type VoiceParticipant = {
  identity: string;
  name: string;
  avatarUrl?: string;
  isSpeaking: boolean;
  isMuted: boolean;
};

type ParticipantMetadata = {
  avatarUrl?: string;
};

type CallStatusPayload = {
  channelId?: number;
  action?: 'join' | 'leave';
  userId: number;
  username?: string;
  avatarUrl?: string;
};

type ProcessedAudio = {
  track: LocalAudioTrack;
  sourceStream: MediaStream;
  audioContext: AudioContext;
  gainNode: GainNode;
};

function parseMetadata(metadata?: string): ParticipantMetadata {
  if (!metadata) return {};
  try {
    return JSON.parse(metadata) as ParticipantMetadata;
  } catch {
    return {};
  }
}

function buttonClass(active = false, danger = false) {
  if (danger) {
    return 'flex h-11 w-11 items-center justify-center rounded-xl bg-red-500/90 text-white hover:bg-red-500';
  }
  if (active) {
    return 'flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-500 text-white hover:bg-indigo-400';
  }
  return 'flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-800 text-zinc-300 hover:bg-zinc-700';
}

export default function VoiceSessionDock() {
  const currentUser = useChatStore((state) => state.currentUser);
  const currentChannel = useChatStore((state) => state.currentChannel);
  const isInCall = useChatStore((state) => state.isInCall);
  const activeVoiceChannel = useChatStore((state) => state.activeVoiceChannel);
  const voiceParticipants = useChatStore((state) => state.voiceParticipants);
  const isMuted = useChatStore((state) => state.voiceIsMuted);
  const isDeafened = useChatStore((state) => state.voiceIsDeafened);
  const inputVolume = useChatStore((state) => state.voiceInputVolume);
  const outputVolume = useChatStore((state) => state.voiceOutputVolume);
  const voiceError = useChatStore((state) => state.voiceError);
  const voiceJoinRequest = useChatStore((state) => state.voiceJoinRequest);
  const joinCall = useChatStore((state) => state.joinCall);
  const leaveCall = useChatStore((state) => state.leaveCall);
  const setActiveVoiceChannel = useChatStore((state) => state.setActiveVoiceChannel);
  const setVoiceParticipants = useChatStore((state) => state.setVoiceParticipants);
  const setVoiceMuted = useChatStore((state) => state.setVoiceMuted);
  const setVoiceDeafened = useChatStore((state) => state.setVoiceDeafened);
  const setVoiceInputVolume = useChatStore((state) => state.setVoiceInputVolume);
  const setVoiceOutputVolume = useChatStore((state) => state.setVoiceOutputVolume);
  const setVoiceError = useChatStore((state) => state.setVoiceError);

  const [isConnecting, setIsConnecting] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const roomRef = useRef<Room | null>(null);
  const localAudioTrackRef = useRef<LocalAudioTrack | null>(null);
  const sourceStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputGainNodeRef = useRef<GainNode | null>(null);
  const remoteAudioElementsRef = useRef<Map<string, HTMLMediaElement>>(new Map());
  const activeVoiceChannelRef = useRef<VoiceChannel | null>(null);
  const isLeavingRef = useRef(false);
  const handledJoinNonceRef = useRef<number | null>(null);

  const selectedVoiceChannel = currentChannel?.type === 'voice' ? currentChannel as VoiceChannel : null;
  const targetChannel = activeVoiceChannel || selectedVoiceChannel;
  const canJoinSelectedVoice = !!selectedVoiceChannel && !isConnecting;

  useEffect(() => {
    activeVoiceChannelRef.current = activeVoiceChannel as VoiceChannel | null;
  }, [activeVoiceChannel]);

  const applyOutputVolume = useCallback(() => {
    const volume = isDeafened ? 0 : outputVolume / 100;
    remoteAudioElementsRef.current.forEach((element) => {
      element.volume = volume;
      element.muted = isDeafened;
    });
  }, [isDeafened, outputVolume]);

  useEffect(() => {
    applyOutputVolume();
  }, [applyOutputVolume]);

  useEffect(() => {
    const gainNode = inputGainNodeRef.current;
    const audioContext = audioContextRef.current;
    if (!gainNode || !audioContext) return;
    gainNode.gain.setTargetAtTime(inputVolume / 100, audioContext.currentTime, 0.01);
  }, [inputVolume]);

  const participantsArray = useCallback((updater: (items: Map<string, VoiceParticipant>) => void) => {
    const current = new Map(useChatStore.getState().voiceParticipants.map((participant) => [participant.identity, participant]));
    updater(current);
    setVoiceParticipants(Array.from(current.values()));
  }, [setVoiceParticipants]);

  const addParticipant = useCallback((participant: Participant) => {
    const metadata = parseMetadata(participant.metadata);
    participantsArray((items) => {
      items.set(participant.identity, {
        identity: participant.identity,
        name: participant.name || participant.identity,
        avatarUrl: metadata.avatarUrl,
        isSpeaking: false,
        isMuted: Array.from(participant.audioTrackPublications.values()).every((publication) => publication.isMuted),
      });
    });
  }, [participantsArray]);

  const removeParticipant = useCallback((identity: string) => {
    participantsArray((items) => {
      items.delete(identity);
    });
  }, [participantsArray]);

  const updateSpeakingStatus = useCallback((speakers: Participant[]) => {
    const speakingIds = new Set(speakers.map((speaker) => speaker.identity));
    participantsArray((items) => {
      items.forEach((participant, identity) => {
        items.set(identity, { ...participant, isSpeaking: speakingIds.has(identity) });
      });
    });
  }, [participantsArray]);

  const updateParticipantMute = useCallback((identity: string, isParticipantMuted: boolean) => {
    participantsArray((items) => {
      const participant = items.get(identity);
      if (participant) {
        items.set(identity, { ...participant, isMuted: isParticipantMuted });
      }
    });
  }, [participantsArray]);

  const addCurrentUserParticipant = useCallback(() => {
    if (!currentUser) return;
    participantsArray((items) => {
      items.set(String(currentUser.id), {
        identity: String(currentUser.id),
        name: currentUser.username || 'You',
        avatarUrl: currentUser.avatarUrl,
        isSpeaking: false,
        isMuted,
      });
    });
  }, [currentUser, isMuted, participantsArray]);

  const cleanupLocalAudio = useCallback(async () => {
    localAudioTrackRef.current?.stop();
    localAudioTrackRef.current = null;

    sourceStreamRef.current?.getTracks().forEach((track) => track.stop());
    sourceStreamRef.current = null;

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      await audioContextRef.current.close().catch(() => {});
    }
    audioContextRef.current = null;
    inputGainNodeRef.current = null;
  }, []);

  const cleanupRemoteAudio = useCallback(() => {
    remoteAudioElementsRef.current.forEach((element) => element.remove());
    remoteAudioElementsRef.current.clear();
  }, []);

  const createProcessedAudioTrack = useCallback(async (): Promise<ProcessedAudio> => {
    const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
    const audioContext = new AudioContextConstructor();
    const sourceStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: false,
      },
    });
    const source = audioContext.createMediaStreamSource(sourceStream);
    const gainNode = audioContext.createGain();
    gainNode.gain.value = inputVolume / 100;
    const destination = audioContext.createMediaStreamDestination();
    source.connect(gainNode);
    gainNode.connect(destination);

    const mediaTrack = destination.stream.getAudioTracks()[0];
    const track = new LocalAudioTrack(mediaTrack, undefined, true, audioContext);
    track.source = Track.Source.Microphone;
    return { track, sourceStream, audioContext, gainNode };
  }, [inputVolume]);

  const getToken = async (roomName: string): Promise<{ token: string; livekitUrl: string }> => {
    return api.get<{ token: string; livekitUrl: string }>(`/api/livekit/token?room=${encodeURIComponent(roomName)}`);
  };

  const leaveVoiceCall = useCallback(async () => {
    if (isLeavingRef.current) return;
    isLeavingRef.current = true;

    const leavingChannel = activeVoiceChannelRef.current;
    if (leavingChannel) {
      await connectWebSocket().catch(() => {});
      sendWebSocketMessage('voice:leave', { channelId: leavingChannel.id });
    }

    const room = roomRef.current;
    roomRef.current = null;
    if (room) {
      await room.disconnect().catch(() => {});
    }

    await cleanupLocalAudio();
    cleanupRemoteAudio();
    setVoiceParticipants([]);
    setVoiceMuted(false);
    setVoiceDeafened(false);
    setVoiceError(null);
    leaveCall();
    isLeavingRef.current = false;
  }, [cleanupLocalAudio, cleanupRemoteAudio, leaveCall, setVoiceDeafened, setVoiceError, setVoiceMuted, setVoiceParticipants]);

  const joinVoiceChannel = useCallback(async (channel: VoiceChannel) => {
    if (!currentUser || isConnecting) return;
    if (roomRef.current && activeVoiceChannelRef.current?.id === channel.id) return;

    setIsConnecting(true);
    setVoiceError(null);
    try {
      if (roomRef.current) {
        await leaveVoiceCall();
      }

      await connectWebSocket().catch(() => {});
      const roomName = `channel-${channel.id}`;
      const { token, livekitUrl } = await getToken(roomName);
      const room = new Room({ adaptiveStream: true, dynacast: true });
      roomRef.current = room;

      room.on(RoomEvent.ParticipantConnected, addParticipant);
      room.on(RoomEvent.ParticipantDisconnected, (participant: Participant) => {
        removeParticipant(participant.identity);
        const element = remoteAudioElementsRef.current.get(participant.identity);
        element?.remove();
        remoteAudioElementsRef.current.delete(participant.identity);
      });
      room.on(RoomEvent.ActiveSpeakersChanged, updateSpeakingStatus);
      room.on(RoomEvent.TrackMuted, (_publication, participant) => {
        updateParticipantMute(participant.identity, true);
      });
      room.on(RoomEvent.TrackUnmuted, (_publication, participant) => {
        updateParticipantMute(participant.identity, false);
      });
      room.on(RoomEvent.TrackSubscribed, (track, _publication, participant) => {
        if (track.kind !== Track.Kind.Audio) return;
        const audioElement = track.attach() as HTMLAudioElement;
        audioElement.id = `audio-${participant.identity}`;
        audioElement.autoplay = true;
        audioElement.volume = isDeafened ? 0 : outputVolume / 100;
        audioElement.muted = isDeafened;
        document.body.appendChild(audioElement);
        remoteAudioElementsRef.current.set(participant.identity, audioElement);
      });
      room.on(RoomEvent.TrackUnsubscribed, (track, _publication, participant) => {
        if (track.kind !== Track.Kind.Audio) return;
        track.detach().forEach((element) => element.remove());
        remoteAudioElementsRef.current.delete(participant.identity);
      });

      await room.connect(livekitUrl, token);

      const processedAudio = await createProcessedAudioTrack();
      localAudioTrackRef.current = processedAudio.track;
      sourceStreamRef.current = processedAudio.sourceStream;
      audioContextRef.current = processedAudio.audioContext;
      inputGainNodeRef.current = processedAudio.gainNode;
      await room.localParticipant.publishTrack(processedAudio.track, { source: Track.Source.Microphone });

      room.remoteParticipants.forEach((participant) => {
        addParticipant(participant);
        participant.audioTrackPublications.forEach((publication) => {
          if (!publication.track) return;
          const audioElement = publication.track.attach() as HTMLAudioElement;
          audioElement.id = `audio-${participant.identity}`;
          audioElement.autoplay = true;
          audioElement.volume = isDeafened ? 0 : outputVolume / 100;
          audioElement.muted = isDeafened;
          document.body.appendChild(audioElement);
          remoteAudioElementsRef.current.set(participant.identity, audioElement);
        });
      });

      setActiveVoiceChannel(channel);
      addCurrentUserParticipant();
      sendWebSocketMessage('voice:join', { channelId: channel.id });
      joinCall();
    } catch (err) {
      console.error('[LiveKit] Failed to join:', err);
      await cleanupLocalAudio();
      cleanupRemoteAudio();
      roomRef.current = null;
      leaveCall();
      setVoiceError(err instanceof Error ? err.message : '加入语音失败');
    } finally {
      setIsConnecting(false);
    }
  }, [
    addCurrentUserParticipant,
    addParticipant,
    cleanupLocalAudio,
    cleanupRemoteAudio,
    createProcessedAudioTrack,
    currentUser,
    isConnecting,
    isDeafened,
    joinCall,
    leaveCall,
    leaveVoiceCall,
    outputVolume,
    removeParticipant,
    setActiveVoiceChannel,
    setVoiceError,
    updateParticipantMute,
    updateSpeakingStatus,
  ]);

  useEffect(() => {
    if (!voiceJoinRequest || handledJoinNonceRef.current === voiceJoinRequest.nonce) return;
    handledJoinNonceRef.current = voiceJoinRequest.nonce;
    void joinVoiceChannel(voiceJoinRequest.channel as VoiceChannel);
  }, [joinVoiceChannel, voiceJoinRequest]);

  useEffect(() => {
    if (!currentUser) return;
    const unsubscribe = onWebSocketMessage('voice:call-status', (rawData) => {
      const data = rawData as CallStatusPayload;
      const activeChannelId = activeVoiceChannelRef.current?.id;
      if (!activeChannelId || data.channelId !== activeChannelId || !data.userId) return;

      if (data.action === 'join') {
        participantsArray((items) => {
          const identity = String(data.userId);
          if (!items.has(identity)) {
            items.set(identity, {
              identity,
              name: data.username || 'Unknown',
              avatarUrl: data.avatarUrl,
              isSpeaking: false,
              isMuted: false,
            });
          }
        });
      }

      if (data.action === 'leave') {
        removeParticipant(String(data.userId));
      }
    });
    return unsubscribe;
  }, [currentUser, participantsArray, removeParticipant]);

  useEffect(() => {
    addCurrentUserParticipant();
  }, [addCurrentUserParticipant]);

  useEffect(() => {
    return () => {
      void leaveVoiceCall();
    };
  }, [leaveVoiceCall]);

  const toggleMute = async () => {
    if (!localAudioTrackRef.current) return;
    const nextMuted = !isMuted;
    if (nextMuted) {
      await localAudioTrackRef.current.mute();
    } else {
      await localAudioTrackRef.current.unmute();
    }
    setVoiceMuted(nextMuted);
    updateParticipantMute(String(currentUser?.id || ''), nextMuted);
  };

  const toggleDeafen = () => {
    setVoiceDeafened(!isDeafened);
  };

  const handlePrimaryClick = () => {
    if (isInCall) return;
    if (selectedVoiceChannel) {
      void joinVoiceChannel(selectedVoiceChannel);
    }
  };

  const participantSummary = useMemo(() => {
    if (!isInCall) return '未加入语音';
    const count = voiceParticipants.length || 1;
    return `${count} 人通话中`;
  }, [isInCall, voiceParticipants.length]);

  if (!currentUser) return null;

  return (
    <div
      className="fixed bottom-[150px] left-[16px] z-40"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {isHovering && (
        <div className="absolute bottom-0 left-[56px] w-72 rounded-lg border border-zinc-700 bg-[#151517] p-3 shadow-2xl">
          <div className="mb-3">
            <p className="truncate text-sm font-medium text-white">{targetChannel?.name || '语音频道'}</p>
            <p className="text-xs text-zinc-500">{participantSummary}</p>
            {voiceError && <p className="mt-2 rounded-md bg-red-500/10 px-2 py-1 text-xs text-red-300">{voiceError}</p>}
          </div>
          <div className="space-y-3">
            <label className="block">
              <div className="mb-1 flex items-center justify-between text-xs text-zinc-400">
                <span className="flex items-center gap-1"><Mic className="h-3.5 w-3.5" /> 麦克风输入</span>
                <span>{inputVolume}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="200"
                value={inputVolume}
                onChange={(event) => setVoiceInputVolume(Number(event.target.value))}
                className="w-full accent-indigo-500"
              />
            </label>
            <label className="block">
              <div className="mb-1 flex items-center justify-between text-xs text-zinc-400">
                <span className="flex items-center gap-1"><Volume2 className="h-3.5 w-3.5" /> 接收音量</span>
                <span>{isDeafened ? 0 : outputVolume}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={outputVolume}
                onChange={(event) => setVoiceOutputVolume(Number(event.target.value))}
                className="w-full accent-indigo-500"
              />
            </label>
          </div>
        </div>
      )}

      <div className="flex flex-col items-center gap-2 rounded-2xl border border-zinc-800 bg-[#111113]/95 p-1.5 shadow-xl">
        {!isInCall ? (
          <button
            type="button"
            onClick={handlePrimaryClick}
            disabled={!canJoinSelectedVoice}
            className={`${buttonClass(canJoinSelectedVoice)} disabled:cursor-not-allowed disabled:opacity-40`}
            title={selectedVoiceChannel ? `加入 ${selectedVoiceChannel.name}` : '选择语音频道后加入'}
          >
            {isConnecting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Radio className="h-5 w-5" />}
          </button>
        ) : (
          <>
            <button type="button" onClick={() => void toggleMute()} className={buttonClass(isMuted)} title={isMuted ? '打开麦克风' : '关闭麦克风'}>
              {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </button>
            <button type="button" onClick={toggleDeafen} className={buttonClass(isDeafened)} title={isDeafened ? '恢复接收声音' : '关闭接收声音'}>
              <Headphones className="h-5 w-5" />
            </button>
            <button type="button" onClick={() => void leaveVoiceCall()} className={buttonClass(false, true)} title="离开语音">
              <PhoneOff className="h-5 w-5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
