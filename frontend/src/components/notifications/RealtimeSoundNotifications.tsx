"use client";

import { useEffect } from 'react';
import { onWebSocketMessage } from '@/lib/socket';
import { playDirectMessageSound, playVoiceJoinSound, unlockNotificationSounds } from '@/lib/notificationSounds';
import { useChatStore } from '@/store/useChatStore';

type DirectMessagePayload = {
  conversationId?: number;
  message?: {
    sender?: {
      id?: number;
    };
  };
};

type VoiceCallStatusPayload = {
  channelId?: number;
  action?: 'join' | 'leave';
  userId?: number;
};

export default function RealtimeSoundNotifications() {
  const currentUser = useChatStore((state) => state.currentUser);
  const activeDirectConversationId = useChatStore((state) => state.activeDirectConversationId);
  const activeVoiceChannel = useChatStore((state) => state.activeVoiceChannel);
  const isInCall = useChatStore((state) => state.isInCall);
  const isDeafened = useChatStore((state) => state.voiceIsDeafened);

  useEffect(() => {
    const unlock = () => unlockNotificationSounds();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    const unsubscribeDirect = onWebSocketMessage('dm:message', (rawData) => {
      const data = rawData as DirectMessagePayload;
      const senderId = data.message?.sender?.id;
      if (!senderId || senderId === currentUser.id) return;
      if (data.conversationId && data.conversationId === activeDirectConversationId) return;
      playDirectMessageSound();
    });

    const unsubscribeVoice = onWebSocketMessage('voice:call-status', (rawData) => {
      const data = rawData as VoiceCallStatusPayload;
      if (data.action !== 'join') return;
      if (isDeafened) return;
      if (!isInCall || !activeVoiceChannel?.id) return;
      if (data.channelId !== activeVoiceChannel.id) return;
      if (!data.userId || data.userId === currentUser.id) return;
      playVoiceJoinSound();
    });

    return () => {
      unsubscribeDirect();
      unsubscribeVoice();
    };
  }, [activeDirectConversationId, activeVoiceChannel?.id, currentUser, isDeafened, isInCall]);

  return null;
}
