import { useEffect, useState, useCallback, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { getSocket, cleanupSocket } from '../lib/socket';

interface UseSocketOptions {
  url: string;
  autoConnect?: boolean;
}

export const useSocket = (options: UseSocketOptions) => {
  const { autoConnect = true } = options;
  const [isConnected, setIsConnected] = useState(false);
  const [socketError, setSocketError] = useState<Error | null>(null);
  const socketRef = useRef<Socket | null>(null);
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

  // 获取全局socket实例
  const getGlobalSocket = useCallback((): Socket => {
    if (!socketRef.current) {
      try {
        // console.log('🔧 获取全局socket实例...');
        const socket = getSocket();
        socketRef.current = socket;
        
        // 检查当前连接状态
        // console.log('🔧 Socket当前连接状态:', socket.connected);
        if (socket.connected) {
          // console.log('✅ Socket已经连接，直接更新状态');
          // console.log('Socket ID:', socket.id);
          setIsConnected(true);
          setSocketError(null);
        }
        
        // 只添加一次事件监听器
        if (!socket.hasListeners('connect')) {
          // console.log('🔧 添加socket事件监听器...');
          // 连接事件
          socket.on('connect', () => {
            // console.log('✅ Socket connected');
            // console.log('Socket ID:', socket.id);
            setIsConnected(true);
            setSocketError(null);
          });

          // 断开连接事件
          socket.on('disconnect', (reason) => {
            // console.log('❌ Socket disconnected:', reason);
            setIsConnected(false);
          });

          // 连接错误事件
          socket.on('connect_error', (error) => {
            const errorMsg = error.message || 'Unknown error';
            const currentTime = Date.now();
            
            // 避免相同错误在短时间内重复日志
            if (errorMsg !== lastErrorMsg.current || currentTime - lastErrorTime.current > 3000) {
              console.error('❌ Socket connection error:', error);
              console.error('Error message:', errorMsg);
              console.error('Error code:', (error as any).code);
              lastErrorMsg.current = errorMsg;
              lastErrorTime.current = currentTime;
            }
            
            setSocketError(error);
            setIsConnected(false);
          });

          // 重连尝试事件
          socket.on('reconnect_attempt', (attemptNumber) => {
            // console.log('🔄 Socket reconnect attempt:', attemptNumber);
          });

          // 重连成功事件
          socket.on('reconnect', (attemptNumber) => {
            // console.log('✅ Socket reconnected after', attemptNumber, 'attempts');
            setIsConnected(true);
            setSocketError(null);
          });

          // 重连失败事件
          socket.on('reconnect_failed', () => {
            // console.error('❌ Socket reconnect failed');
          });
        }
      } catch (error) {
        const err = toError(error);
        console.error('❌ 获取socket实例失败:', err);
        setSocketError(err);
        setIsConnected(false);
        // 不再抛出错误，而是创建一个模拟的socket实例
        // 这样即使socket连接失败，应用也能继续运行
        // console.log('🔧 创建模拟socket实例以避免应用崩溃');
        const mockSocket = {
          connected: false,
          id: 'mock-socket-id',
          on: () => {},
          off: () => {},
          once: () => {},
          emit: () => {},
          connect: () => {},
          disconnect: () => {},
          hasListeners: () => false,
          io: {}
        } as unknown as Socket;
        socketRef.current = mockSocket;
      }
    } else {
      // 检查现有socket的连接状态
      const socket = socketRef.current;
      // console.log('🔧 检查现有socket连接状态:', socket.connected);
      if (socket.connected && !isConnected) {
        // console.log('✅ 现有socket已连接，更新状态');
        // console.log('Socket ID:', socket.id);
        setIsConnected(true);
        setSocketError(null);
      }
    }
    
    return socketRef.current;
  }, [isConnected]);

  // 连接 socket
  const connect = useCallback(() => {
    const currentTime = Date.now();
    
    // 检查是否在冷却期内
    if (reconnectAttempts.current >= MAX_RECONNECT_ATTEMPTS && 
        currentTime - lastReconnectTime.current < RECONNECT_COOLDOWN) {
      // console.log('Reconnect attempts exceeded, waiting for cooldown period');
      return;
    }
    
    try {
      // console.log('🔄 连接socket...');
      const socket = getGlobalSocket();
      if (!socket.connected) {
        // console.log('🔄 尝试连接socket...');
        socket.connect();
        reconnectAttempts.current++;
        lastReconnectTime.current = currentTime;
      } else {
        // console.log('✅ Socket已经连接');
        setIsConnected(true);
        setSocketError(null);
        reconnectAttempts.current = 0;
      }
    } catch (error) {
      const err = toError(error);
      console.error('❌ 连接socket失败:', err);
      setSocketError(err);
      setIsConnected(false);
    }
  }, [getGlobalSocket]);

  // 断开连接
  const disconnect = useCallback(() => {
    try {
      // console.log('🔄 断开socket连接...');
      cleanupSocket();
      socketRef.current = null;
      setIsConnected(false);
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
    // console.log('🔄 Reconnect state reset');
  }, []);

  // 发送消息
  const emit = useCallback((event: string, data?: unknown) => {
    try {
      // 只有在需要时才获取socket实例
      if (!socketRef.current) {
        getGlobalSocket();
      }
      const socket = socketRef.current;
      if (socket && socket.connected) {
        socket.emit(event, data);
        return true;
      } else {
        return false;
      }
    } catch (error) {
      const err = toError(error);
      console.error('❌ 发送事件失败:', err);
      return false;
    }
  }, [getGlobalSocket]);

  // 监听事件
  const on = useCallback((event: string, callback: (...args: unknown[]) => void) => {
    try {
      // 只有在需要时才获取socket实例
      if (!socketRef.current) {
        getGlobalSocket();
      }
      const socket = socketRef.current;
      if (socket) {
        // 先移除可能存在的旧监听器
        socket.off(event, callback);
        // 再添加新监听器
        socket.on(event, callback);
        return () => {
          socket.off(event, callback);
        };
      }
      return () => {};
    } catch (error) {
      const err = toError(error);
      console.error('❌ 设置事件监听器失败:', err);
      return () => {};
    }
  }, [getGlobalSocket]);

  // 监听单次事件
  const once = useCallback((event: string, callback: (...args: unknown[]) => void) => {
    try {
      // 只有在需要时才获取socket实例
      if (!socketRef.current) {
        getGlobalSocket();
      }
      const socket = socketRef.current;
      if (socket) {
        socket.once(event, callback);
      }
    } catch (error) {
      const err = toError(error);
      console.error('❌ 设置单次事件监听器失败:', err);
    }
  }, [getGlobalSocket]);

  // 移除事件监听
  const off = useCallback((event: string, callback?: (...args: unknown[]) => void) => {
    try {
      // 只有在需要时才获取socket实例
      if (!socketRef.current) {
        getGlobalSocket();
      }
      const socket = socketRef.current;
      if (socket) {
        socket.off(event, callback);
      }
    } catch (error) {
      const err = toError(error);
      console.error('❌ 移除事件监听器失败:', err);
    }
  }, [getGlobalSocket]);

  // 组件挂载时自动连接
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    if (autoConnect) {
      // console.log('🔄 自动连接socket...');
      timeoutId = setTimeout(() => {
        connect();
      }, 0);
    }

    // 组件卸载时不自动断开连接，因为其他组件可能还在使用
    return () => {
      clearTimeout(timeoutId);
      // 不在这里调用disconnect，保持全局socket连接
    };
  }, [autoConnect, connect]);

  return {
    isConnected,
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
