import { useEffect, useState, useCallback, useRef } from 'react';
import { getSocket, cleanupSocket, onWebSocketMessage, onConnect, onDisconnect, connectWebSocket, isConnected } from '../lib/socket';

interface UseSocketOptions {
  url: string;
  autoConnect?: boolean;
}

export const useSocket = (options: UseSocketOptions) => {
  const { autoConnect = true } = options;
  const [isConnectedState, setIsConnectedState] = useState(false);
  const [socketError, setSocketError] = useState<Error | null>(null);

  // 错误去重跟踪
  const lastErrorTime = useRef(0);
  const lastErrorMsg = useRef('');

  // 重连状态管理
  const reconnectAttempts = useRef(0);
  const lastReconnectTime = useRef(0);
  const MAX_RECONNECT_ATTEMPTS = 3;
  const RECONNECT_COOLDOWN = 30000; // 30秒冷却期

  const toError = (err: unknown): Error => {
    if (err instanceof Error) return err;
    if (typeof err === 'string') return new Error(err);

    const messageFromObject =
      typeof err === 'object' && err !== null && 'message' in err
        ? (err as { message?: unknown }).message
        : undefined;
    if (typeof messageFromObject === 'string') return new Error(messageFromObject);

    return new Error('Unknown error');
  };

  // 连接 socket
  const connect = useCallback(() => {
    const currentTime = Date.now();

    // 检查是否在冷却期内
    if (reconnectAttempts.current >= MAX_RECONNECT_ATTEMPTS &&
        currentTime - lastReconnectTime.current < RECONNECT_COOLDOWN) {
      return;
    }

    try {
      connectWebSocket()
        .then(() => {
          setIsConnectedState(true);
          setSocketError(null);
          reconnectAttempts.current = 0;
        })
        .catch((err) => {
          const error = toError(err);
          setSocketError(error);
          setIsConnectedState(false);
          reconnectAttempts.current++;
          lastReconnectTime.current = currentTime;
        });
    } catch (error) {
      const err = toError(error);
      console.error('❌ 连接socket失败:', err);
      setSocketError(err);
      setIsConnectedState(false);
    }
  }, []);

  // 断开连接
  const disconnect = useCallback(() => {
    try {
      cleanupSocket();
      setIsConnectedState(false);
      // 重置重连状态
      reconnectAttempts.current = 0;
      lastReconnectTime.current = 0;
    } catch (error) {
      const err = toError(error);
      console.error('❌ 断开socket连接失败:', err);
    }
  }, []);

  // 重置重连状态
  const resetReconnectState = useCallback(() => {
    reconnectAttempts.current = 0;
    lastReconnectTime.current = 0;
  }, []);

  // 发送消息
  const emit = useCallback((event: string, data?: unknown) => {
    try {
      const socket = getSocket();
      if (socket && socket.connected) {
        return socket.emit(event, data);
      }
      return false;
    } catch (error) {
      const err = toError(error);
      console.error('❌ 发送事件失败:', err);
      return false;
    }
  }, []);

  // 监听事件
  const on = useCallback((event: string, callback: (...args: unknown[]) => void) => {
    try {
      // 使用原生WebSocket的消息订阅
      const unsubscribe = onWebSocketMessage(event, callback);
      return unsubscribe;
    } catch (error) {
      const err = toError(error);
      console.error('❌ 设置事件监听器失败:', err);
      return () => {};
    }
  }, []);

  // 监听单次事件
  const once = useCallback((event: string, callback: (...args: unknown[]) => void) => {
    try {
      const unsubscribe = onWebSocketMessage(event, (data) => {
        callback(data);
        unsubscribe();
      });
    } catch (error) {
      const err = toError(error);
      console.error('❌ 设置单次事件监听器失败:', err);
    }
  }, []);

  // 移除事件监听
  const off = useCallback((event: string, callback?: (...args: unknown[]) => void) => {
    // Handler removal is handled by the returned unsubscribe function from on()
  }, []);

  // 组件挂载时自动连接
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    // 设置连接状态监听
    onConnect(() => {
      setIsConnectedState(true);
      setSocketError(null);
    });

    onDisconnect(() => {
      setIsConnectedState(false);
    });

    if (autoConnect) {
      timeoutId = setTimeout(() => {
        // 检查是否已连接
        if (isConnected()) {
          setIsConnectedState(true);
        } else {
          connect();
        }
      }, 0);
    }

    return () => {
      clearTimeout(timeoutId);
    };
  }, [autoConnect, connect]);

  return {
    isConnected: isConnectedState,
    socketError,
    connect,
    disconnect,
    emit,
    on,
    once,
    off,
    resetReconnectState,
  };
};