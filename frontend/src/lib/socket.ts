// WebSocket connection management
// Using native WebSocket (compatible with gorilla/websocket backend)

import { config } from './config';
import { getStoredToken } from '@/store/useChatStore';

// Global WebSocket instance
let wsInstance: WebSocket | null = null;
let connectPromise: Promise<WebSocket> | null = null;
let isConnecting = false;
let reconnectAttempts = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let shouldReconnect = true;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 2000;

// Message handlers
type MessageHandler = (data: unknown) => void;
const messageHandlers: Map<string, Set<MessageHandler>> = new Map();

type WebSocketEnvelope = {
  type?: string;
  payload?: unknown;
  [key: string]: unknown;
};

// Connection state callbacks
const connectCallbacks = new Set<() => void>();
const disconnectCallbacks = new Set<() => void>();

// Get or create WebSocket instance
export const getWebSocket = (): WebSocket | null => {
  if (!wsInstance && !isConnecting) {
    connectWebSocket();
  }
  return wsInstance;
};

// Connect to WebSocket server
export const connectWebSocket = (): Promise<WebSocket> => {
  if (wsInstance && wsInstance.readyState === WebSocket.OPEN) {
    return Promise.resolve(wsInstance);
  }

  if (connectPromise) {
    return connectPromise;
  }

  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  connectPromise = new Promise((resolve, reject) => {
    shouldReconnect = true;

    isConnecting = true;
    const token = getStoredToken();
    if (!token) {
      isConnecting = false;
      connectPromise = null;
      reject(new Error('No token available'));
      return;
    }

    // WebSocket URL - use ws:// or wss:// based on http/https
    let wsUrl = config.api.socketUrl;
    if (wsUrl.startsWith('https://')) {
      wsUrl = wsUrl.replace('https://', 'wss://');
    } else if (wsUrl.startsWith('http://')) {
      wsUrl = wsUrl.replace('http://', 'ws://');
    }
    // Pass token as query parameter for WebSocket authentication
    const url = `${wsUrl}/api/ws?token=${encodeURIComponent(token)}`;

    try {
      console.log('Attempting WebSocket connection to:', url.replace(/token=[^&]+/, 'token=***'));

      wsInstance = new WebSocket(url);

      wsInstance.onopen = () => {
        console.log('WebSocket connected');
        isConnecting = false;
        reconnectAttempts = 0;
        connectPromise = null;
        connectCallbacks.forEach((callback) => callback());
        resolve(wsInstance!);
      };

      wsInstance.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as WebSocketEnvelope;
          const { type, payload } = message;

          // Debug log for voice events
          if (type?.startsWith('voice:')) {
            console.log('[WS] Received:', type, payload);
          }

          // Call registered handlers
          const handlers = type ? messageHandlers.get(type) : undefined;
          if (handlers) {
            handlers.forEach(handler => handler(payload || message));
          }

          // Call wildcard handlers
          const wildcardHandlers = messageHandlers.get('*');
          if (wildcardHandlers) {
            wildcardHandlers.forEach(handler => handler(message));
          }
        } catch {
          // Silently ignore parse errors for non-JSON messages
        }
      };

      wsInstance.onerror = () => {
        // Don't log - WebSocket errors are expected during reconnection
        isConnecting = false;
      };

      wsInstance.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason);
        isConnecting = false;
        wsInstance = null;
        connectPromise = null;
        disconnectCallbacks.forEach((callback) => callback());

        // Attempt reconnect if not a normal closure
        if (shouldReconnect && event.code !== 1000 && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttempts++;
          console.log(`Reconnecting... Attempt ${reconnectAttempts}`);
          reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            connectWebSocket().catch(() => {});
          }, RECONNECT_DELAY * reconnectAttempts);
        }
      };

    } catch (error) {
      isConnecting = false;
      connectPromise = null;
      reject(error);
    }
  });

  return connectPromise;
};

// Send message
export const sendWebSocketMessage = (type: string, payload?: unknown): boolean => {
  if (!wsInstance || wsInstance.readyState !== WebSocket.OPEN) {
    console.warn('WebSocket not connected');
    return false;
  }

  try {
    // 先展开 payload,再覆盖 type,确保 type 不被 payload 覆盖
    const message = payload && typeof payload === 'object' && !Array.isArray(payload)
      ? { ...payload, type }
      : { type, payload };
    // Debug log for voice events
    if (type.startsWith('voice:')) {
      console.log('[WS] Sending:', type, payload);
    }
    wsInstance.send(JSON.stringify(message));
    return true;
  } catch (error) {
    console.error('Failed to send WebSocket message:', error);
    return false;
  }
};

// Subscribe to message type
export const onWebSocketMessage = (type: string, handler: MessageHandler): (() => void) => {
  if (!messageHandlers.has(type)) {
    messageHandlers.set(type, new Set());
  }
  messageHandlers.get(type)!.add(handler);

  // Return unsubscribe function
  return () => {
    const handlers = messageHandlers.get(type);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        messageHandlers.delete(type);
      }
    }
  };
};

// Set connection callbacks
export const onConnect = (callback: () => void) => {
  connectCallbacks.add(callback);
  return () => {
    connectCallbacks.delete(callback);
  };
};

export const onDisconnect = (callback: () => void) => {
  disconnectCallbacks.add(callback);
  return () => {
    disconnectCallbacks.delete(callback);
  };
};

// Join a channel
export const joinChannel = (channelId: number) => {
  return sendWebSocketMessage('join-channel', { channelId });
};

// Leave a channel
export const leaveChannel = (channelId: number) => {
  return sendWebSocketMessage('leave-channel', { channelId });
};

// Send a chat message
export const sendChatMessage = (channelId: number, content: string) => {
  return sendWebSocketMessage('send-message', { channelId, content });
};

// Cleanup WebSocket
export const cleanupWebSocket = (): void => {
  shouldReconnect = false;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (wsInstance) {
    wsInstance.close();
    wsInstance = null;
  }
  connectPromise = null;
  isConnecting = false;
  reconnectAttempts = 0;
};

// Check if connected
export const isConnected = (): boolean => {
  return wsInstance?.readyState === WebSocket.OPEN;
};

// Legacy compatibility with socket.io interface
export const getSocket = () => {
  return {
    connected: wsInstance?.readyState === WebSocket.OPEN,
    id: 'ws-' + Date.now(),
    on: (event: string, callback: (data?: unknown) => void) => {
      if (event === 'connect') {
        if (wsInstance?.readyState === WebSocket.OPEN) {
          callback({});
        }
        return onConnect(() => callback({}));
      } else if (event === 'disconnect') {
        return onDisconnect(() => callback({}));
      } else {
        return onWebSocketMessage(event, callback);
      }
    },
    off: (_event: string, _callback?: (data?: unknown) => void) => {
      void _event;
      void _callback;
      // Handler removal is handled by the returned unsubscribe function
    },
    once: (event: string, callback: (data?: unknown) => void) => {
      const unsubscribe = onWebSocketMessage(event, (data) => {
        callback(data);
        unsubscribe();
      });
    },
    emit: (event: string, data?: unknown) => {
      return sendWebSocketMessage(event, data);
    },
    connect: () => {
      connectWebSocket().catch(console.error);
    },
    disconnect: () => {
      cleanupWebSocket();
    },
    hasListeners: () => messageHandlers.size > 0,
    io: {}
  };
};

export const cleanupSocket = cleanupWebSocket;
