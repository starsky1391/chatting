# Phase 2: WebSocket Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate WebSocket functionality from Web to Miniapp with configuration separation, real-time messaging, and store alignment.

**Architecture:** Taro.connectSocket for WebSocket, Zustand store matching Web端, defineConstants for environment config.

**Tech Stack:** Taro 3 + React, gorilla/websocket (backend), Zustand

---

## Task 1: Configuration Separation

**Files:**
- Modify: `miniapp/config/index.ts`
- Modify: `miniapp/config/dev.ts`
- Modify: `miniapp/config/prod.ts`
- Create: `miniapp/src/config/index.ts`
- Modify: `miniapp/src/services/api.ts`

- [ ] **Step 1: Add defineConstants to config/index.ts**

Read current `miniapp/config/index.ts`, then add defineConstants to the config object:

```typescript
// miniapp/config/index.ts
const config = {
  projectName: 'miniapp',
  date: '11-5-2026',
  designWidth: 750,
  deviceRatio: {
    640: 2.34 / 2,
    750: 1,
    828: 1.81 / 2
  },
  sourceRoot: 'src',
  outputRoot: 'dist',
  plugins: [],
  defineConstants: {
    API_BASE_URL: '"http://localhost:3001/api"',
    WS_BASE_URL: '"ws://localhost:3001/ws"'
  },
  copy: {
    patterns: [],
    options: {}
  },
  framework: 'react',
  compiler: {
    type: 'webpack5',
    prebundle: { enable: false }
  },
  cache: {
    enable: false
  },
  mini: {},
  h5: {}
}

module.exports = function (merge) {
  if (process.env.NODE_ENV === 'development') {
    return merge({}, config, require('./dev'))
  }
  return merge({}, config, require('./prod'))
}
```

- [ ] **Step 2: Update dev.ts with dev constants**

```typescript
// miniapp/config/dev.ts
module.exports = {
  env: {
    NODE_ENV: '"development"'
  },
  defineConstants: {
    API_BASE_URL: '"http://localhost:3001/api"',
    WS_BASE_URL: '"ws://localhost:3001/ws"'
  },
  mini: {},
  h5: {}
}
```

- [ ] **Step 3: Update prod.ts with prod constants**

```typescript
// miniapp/config/prod.ts
module.exports = {
  env: {
    NODE_ENV: '"production"'
  },
  defineConstants: {
    API_BASE_URL: '"https://api.yourdomain.com/api"',
    WS_BASE_URL: '"wss://api.yourdomain.com/ws"'
  },
  mini: {},
  h5: {}
}
```

- [ ] **Step 4: Create src/config/index.ts**

```typescript
// miniapp/src/config/index.ts
/**
 * 环境配置
 * 通过 defineConstants 在编译时注入
 */

export const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001/api'
export const WS_BASE_URL = process.env.WS_BASE_URL || 'ws://localhost:3001/ws'
```

- [ ] **Step 5: Update api.ts to use config**

```typescript
// miniapp/src/services/api.ts
import Taro from '@tarojs/taro'
import { API_BASE_URL } from '@/config'

interface RequestConfig {
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  data?: any
  header?: Record<string, string>
}

interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

class ApiService {
  private baseUrl: string

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl
  }

  private async getToken(): Promise<string | null> {
    try {
      const res = await Taro.getStorage({ key: 'token' })
      return res.data
    } catch {
      return null
    }
  }

  private async request<T>(config: RequestConfig): Promise<ApiResponse<T>> {
    const token = await this.getToken()

    try {
      const res = await Taro.request({
        url: `${this.baseUrl}${config.url}`,
        method: config.method || 'GET',
        data: config.data,
        header: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...config.header
        }
      })

      if (res.statusCode === 401) {
        await Taro.removeStorage({ key: 'token' })
        Taro.redirectTo({ url: '/pages/login/index' })
        return { success: false, error: '未授权' }
      }

      if (res.statusCode >= 200 && res.statusCode < 300) {
        return { success: true, data: res.data as T }
      }

      return { success: false, error: res.data?.error || '请求失败' }
    } catch (error: any) {
      console.error('API 请求错误:', error)
      return { success: false, error: error.message || '网络错误' }
    }
  }

  async get<T>(url: string, header?: Record<string, string>): Promise<ApiResponse<T>> {
    return this.request<T>({ url, method: 'GET', header })
  }

  async post<T>(url: string, data?: any, header?: Record<string, string>): Promise<ApiResponse<T>> {
    return this.request<T>({ url, method: 'POST', data, header })
  }

  async put<T>(url: string, data?: any, header?: Record<string, string>): Promise<ApiResponse<T>> {
    return this.request<T>({ url, method: 'PUT', data, header })
  }

  async delete<T>(url: string, header?: Record<string, string>): Promise<ApiResponse<T>> {
    return this.request<T>({ url, method: 'DELETE', header })
  }
}

export const api = new ApiService()
```

- [ ] **Step 6: Commit config changes**

```bash
git add miniapp/config/ miniapp/src/config/ miniapp/src/services/api.ts
git commit -m "feat(miniapp): separate config using defineConstants

- Add API_BASE_URL and WS_BASE_URL to defineConstants
- Create src/config/index.ts for centralized exports
- Update api.ts to use config constants

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 2: WebSocket Core Module

**Files:**
- Create: `miniapp/src/services/socket.ts`

- [ ] **Step 1: Create socket.ts with core WebSocket functionality**

```typescript
// miniapp/src/services/socket.ts
import Taro from '@tarojs/taro'
import { WS_BASE_URL } from '@/config'

// 消息处理器类型
type MessageHandler = (data: any) => void

// WebSocket 状态
let socketTask: Taro.SocketTask | null = null
let isConnected = false
let reconnectAttempts = 0
let heartbeatTimer: ReturnType<typeof setInterval> | null = null

// 配置
const MAX_RECONNECT_ATTEMPTS = 5
const RECONNECT_DELAY = 2000
const HEARTBEAT_INTERVAL = 30000

// 消息处理器映射
const messageHandlers = new Map<string, Set<MessageHandler>>()

// 连接状态回调
let onConnectCallback: (() => void) | null = null
let onDisconnectCallback: (() => void) | null = null

/**
 * 连接 WebSocket
 */
export async function connectWebSocket(token: string): Promise<boolean> {
  if (socketTask && isConnected) {
    console.log('[WS] Already connected')
    return true
  }

  const url = `${WS_BASE_URL}?token=${token}`

  try {
    socketTask = await Taro.connectSocket({
      url,
      success: () => {
        console.log('[WS] Connection initiated')
      },
      fail: (err) => {
        console.error('[WS] Connection failed:', err)
      }
    })

    if (!socketTask) {
      return false
    }

    // 监听连接打开
    socketTask.onOpen(() => {
      console.log('[WS] Connected')
      isConnected = true
      reconnectAttempts = 0
      startHeartbeat()
      onConnectCallback?.()
    })

    // 监听消息
    socketTask.onMessage((res) => {
      try {
        const message = JSON.parse(res.data)
        console.log('[WS] Received:', message.type)
        
        // 分发到对应处理器
        const handlers = messageHandlers.get(message.type)
        if (handlers) {
          handlers.forEach(handler => {
            try {
              handler(message.payload || message)
            } catch (e) {
              console.error('[WS] Handler error:', e)
            }
          })
        }

        // 通配符处理器
        const wildcardHandlers = messageHandlers.get('*')
        if (wildcardHandlers) {
          wildcardHandlers.forEach(handler => {
            try {
              handler(message)
            } catch (e) {
              console.error('[WS] Wildcard handler error:', e)
            }
          })
        }
      } catch (e) {
        console.error('[WS] Parse message error:', e)
      }
    })

    // 监听连接关闭
    socketTask.onClose((res) => {
      console.log('[WS] Closed:', res.code, res.reason)
      isConnected = false
      stopHeartbeat()
      onDisconnectCallback?.()
      
      // 非正常关闭时尝试重连
      if (res.code !== 1000 && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        scheduleReconnect(token)
      }
    })

    // 监听错误
    socketTask.onError((err) => {
      console.error('[WS] Error:', err)
      isConnected = false
    })

    return true
  } catch (error) {
    console.error('[WS] Connect error:', error)
    return false
  }
}

/**
 * 断开连接
 */
export function disconnectWebSocket(): void {
  stopHeartbeat()
  if (socketTask) {
    socketTask.close({ code: 1000, reason: 'User disconnect' })
    socketTask = null
  }
  isConnected = false
  reconnectAttempts = MAX_RECONNECT_ATTEMPTS // 阻止自动重连
  console.log('[WS] Disconnected')
}

/**
 * 发送消息
 */
export function sendWebSocketMessage(type: string, payload?: any): boolean {
  if (!socketTask || !isConnected) {
    console.warn('[WS] Not connected, cannot send')
    return false
  }

  const message = JSON.stringify({ type, payload })
  
  socketTask.send({
    data: message,
    success: () => {
      console.log('[WS] Sent:', type)
    },
    fail: (err) => {
      console.error('[WS] Send failed:', err)
    }
  })

  return true
}

/**
 * 订阅消息类型
 */
export function onWebSocketMessage(type: string, handler: MessageHandler): void {
  if (!messageHandlers.has(type)) {
    messageHandlers.set(type, new Set())
  }
  messageHandlers.get(type)!.add(handler)
}

/**
 * 取消订阅
 */
export function offWebSocketMessage(type: string, handler: MessageHandler): void {
  const handlers = messageHandlers.get(type)
  if (handlers) {
    handlers.delete(handler)
    if (handlers.size === 0) {
      messageHandlers.delete(type)
    }
  }
}

/**
 * 清除所有处理器
 */
export function clearAllHandlers(): void {
  messageHandlers.clear()
}

/**
 * 获取连接状态
 */
export function isWebSocketConnected(): boolean {
  return isConnected
}

/**
 * 获取 Socket 实例
 */
export function getSocket(): Taro.SocketTask | null {
  return socketTask
}

/**
 * 设置连接回调
 */
export function onConnect(callback: () => void): void {
  onConnectCallback = callback
}

/**
 * 设置断开回调
 */
export function onDisconnect(callback: () => void): void {
  onDisconnectCallback = callback
}

/**
 * 重置重连状态
 */
export function resetReconnectState(): void {
  reconnectAttempts = 0
}

/**
 * 启动心跳
 */
function startHeartbeat(): void {
  stopHeartbeat()
  heartbeatTimer = setInterval(() => {
    if (isConnected) {
      sendWebSocketMessage('heartbeat', { timestamp: Date.now() })
    }
  }, HEARTBEAT_INTERVAL)
}

/**
 * 停止心跳
 */
function stopHeartbeat(): void {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer)
    heartbeatTimer = null
  }
}

/**
 * 安排重连
 */
function scheduleReconnect(token: string): void {
  reconnectAttempts++
  console.log(`[WS] Reconnecting... Attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}`)
  
  setTimeout(() => {
    if (reconnectAttempts <= MAX_RECONNECT_ATTEMPTS) {
      connectWebSocket(token)
    }
  }, RECONNECT_DELAY * reconnectAttempts)
}

// 便捷方法：加入频道
export function joinChannel(channelId: number): void {
  sendWebSocketMessage('join-channel', { channelId })
}

// 便捷方法：离开频道
export function leaveChannel(channelId: number): void {
  sendWebSocketMessage('leave-channel', { channelId })
}

// 便捷方法：发送聊天消息
export function sendChatMessage(channelId: number, content: { type: string; body: string }): void {
  sendWebSocketMessage('send-message', {
    channelId,
    content
  })
}
```

- [ ] **Step 2: Commit socket.ts**

```bash
git add miniapp/src/services/socket.ts
git commit -m "feat(miniapp): add WebSocket core module

- Taro.connectSocket wrapper with auto-reconnect
- Message handlers subscription pattern
- Heartbeat for connection keepalive
- Convenience methods: joinChannel, leaveChannel, sendChatMessage

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 3: WebSocket Hook

**Files:**
- Create: `miniapp/src/hooks/useSocket.ts`

- [ ] **Step 1: Create useSocket.ts hook**

```typescript
// miniapp/src/hooks/useSocket.ts
import { useState, useCallback, useEffect, useRef } from 'react'
import Taro from '@tarojs/taro'
import {
  connectWebSocket as connectWS,
  disconnectWebSocket,
  sendWebSocketMessage,
  onWebSocketMessage,
  offWebSocketMessage,
  isWebSocketConnected,
  onConnect as setOnConnect,
  onDisconnect as setOnDisconnect,
  resetReconnectState
} from '@/services/socket'

interface UseSocketReturn {
  isConnected: boolean
  socketError: string | null
  connect: () => Promise<void>
  disconnect: () => void
  emit: (type: string, payload?: any) => void
  on: (type: string, handler: (data: any) => void) => void
  once: (type: string, handler: (data: any) => void) => void
  off: (type: string, handler: (data: any) => void) => void
  resetReconnectState: () => void
}

export function useSocket(): UseSocketReturn {
  const [isConnected, setIsConnected] = useState(isWebSocketConnected())
  const [socketError, setSocketError] = useState<string | null>(null)

  // 存储一次性处理器
  const onceHandlersRef = useRef<Map<string, Set<(data: any) => void>>>(new Map())

  // 设置连接状态监听
  useEffect(() => {
    setOnConnect(() => {
      setIsConnected(true)
      setSocketError(null)
    })

    setOnDisconnect(() => {
      setIsConnected(false)
    })

    return () => {
      setOnConnect(() => {})
      setOnDisconnect(() => {})
    }
  }, [])

  // 连接
  const connect = useCallback(async () => {
    try {
      const token = await Taro.getStorage({ key: 'token' })
      const success = await connectWS(token.data)
      if (!success) {
        setSocketError('连接失败')
      }
    } catch (e) {
      setSocketError('未找到登录凭证')
      Taro.redirectTo({ url: '/pages/login/index' })
    }
  }, [])

  // 断开
  const disconnect = useCallback(() => {
    disconnectWebSocket()
    setIsConnected(false)
  }, [])

  // 发送消息
  const emit = useCallback((type: string, payload?: any) => {
    sendWebSocketMessage(type, payload)
  }, [])

  // 订阅
  const on = useCallback((type: string, handler: (data: any) => void) => {
    onWebSocketMessage(type, handler)
  }, [])

  // 一次性订阅
  const once = useCallback((type: string, handler: (data: any) => void) => {
    const wrappedHandler = (data: any) => {
      handler(data)
      off(type, wrappedHandler)
    }
    
    if (!onceHandlersRef.current.has(type)) {
      onceHandlersRef.current.set(type, new Set())
    }
    onceHandlersRef.current.get(type)!.add(wrappedHandler)
    
    onWebSocketMessage(type, wrappedHandler)
  }, [])

  // 取消订阅
  const off = useCallback((type: string, handler: (data: any) => void) => {
    offWebSocketMessage(type, handler)
    
    // 清理一次性处理器引用
    const onceHandlers = onceHandlersRef.current.get(type)
    if (onceHandlers) {
      onceHandlers.delete(handler)
      if (onceHandlers.size === 0) {
        onceHandlersRef.current.delete(type)
      }
    }
  }, [])

  return {
    isConnected,
    socketError,
    connect,
    disconnect,
    emit,
    on,
    once,
    off,
    resetReconnectState
  }
}
```

- [ ] **Step 2: Commit useSocket.ts**

```bash
git add miniapp/src/hooks/useSocket.ts
git commit -m "feat(miniapp): add useSocket hook matching Web端 interface

- connect, disconnect, emit, on, once, off methods
- Connection state management
- Error handling with redirect to login

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 4: Extend Store (Matching Web端)

**Files:**
- Modify: `miniapp/src/store/useChatStore.ts`
- Modify: `miniapp/src/types/index.ts`

- [ ] **Step 1: Update types/index.ts**

Add missing types to match Web端:

```typescript
// miniapp/src/types/index.ts
// 用户类型
export interface User {
  id: number
  username: string
  avatar: string
  avatarUrl?: string
  email?: string
  phone?: string
  status: 'online' | 'offline' | 'busy'
  isOnline?: boolean
  role: 'admin' | 'moderator' | 'member'
  bio?: string
}

// 消息类型
export interface Message {
  id: number
  content: {
    type: string
    body: string
  }
  sender: User
  createdAt: Date | string
  isOwn?: boolean
}

// 频道类型
export interface Channel {
  id: number
  name: string
  type: 'text' | 'voice'
  groupId?: number
  description?: string
  position?: number
  isInCall?: boolean
  callMembers?: number
}

// 群组类型
export interface ChannelGroup {
  id: number
  name: string
  description?: string
  icon?: string
  ownerId: number
  inviteCode: string
  channels: Channel[]
}

// 成员类型
export interface Member {
  id: number
  username: string
  avatar: string
  avatarUrl?: string
  isOnline: boolean
  role: 'admin' | 'moderator' | 'member'
  isInCall?: boolean
}

// WebSocket 消息类型
export interface WSMessage {
  type: string
  room?: string
  sender?: string
  payload?: any
}

// API 响应类型
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

// 微信登录响应类型
export interface WechatLoginResponse {
  accessToken: string
  user: User
  isNew: boolean
}
```

- [ ] **Step 2: Update useChatStore.ts to match Web端**

```typescript
// miniapp/src/store/useChatStore.ts
import { create } from 'zustand'
import Taro from '@tarojs/taro'
import type { User, Message, Channel, Member } from '@/types'

interface ChatState {
  // 用户信息
  currentUser: User | null
  isAuthenticated: boolean
  login: (user: User, token: string) => void
  logout: () => void
  updateCurrentUser: (user: Partial<User>) => void

  // 频道相关
  channels: Channel[]
  currentChannel: Channel | null
  currentGroupId: number | null
  setCurrentChannel: (channel: Channel | null) => void
  setCurrentGroupId: (groupId: number | null) => void
  setChannels: (channels: Channel[]) => void
  addChannel: (channel: Channel) => void
  removeChannel: (channelId: number) => void
  joinChannel: (channel: Channel) => void
  leaveChannel: (channelId: number) => void
  updateChannelCallStatus: (channelId: number, isInCall: boolean, callMembers: number) => void

  // 消息相关
  messages: Message[]
  addMessage: (message: Message) => void
  setMessages: (messages: Message[]) => void

  // 成员相关
  members: Member[]
  groupMembers: Member[]
  setMembers: (members: Member[]) => void
  setGroupMembers: (members: Member[]) => void
  updateMemberOnlineStatus: (memberId: number, isOnline: boolean) => void
  updateMemberCallStatus: (memberId: number, isInCall: boolean) => void

  // 语音通话相关 (miniapp adaptation)
  isInCall: boolean
  isJoiningCall: boolean
  voiceChannelMembers: Member[]
  isMuted: boolean
  joinCall: () => void
  leaveCall: () => void
  toggleMute: () => void
  setVoiceChannelMembers: (members: Member[]) => void
  addVoiceChannelMember: (member: Member) => void
  removeVoiceChannelMember: (memberId: number) => void
}

export const useChatStore = create<ChatState>((set) => ({
  // 用户信息
  currentUser: null,
  isAuthenticated: false,

  login: async (user, token) => {
    await Taro.setStorage({ key: 'user', data: JSON.stringify(user) })
    await Taro.setStorage({ key: 'token', data: token })
    set({
      currentUser: user,
      isAuthenticated: true
    })
  },

  logout: async () => {
    await Taro.removeStorage({ key: 'user' })
    await Taro.removeStorage({ key: 'token' })
    set({
      currentUser: null,
      isAuthenticated: false,
      channels: [],
      currentChannel: null,
      currentGroupId: null,
      messages: [],
      members: [],
      groupMembers: [],
      isInCall: false,
      isJoiningCall: false,
      voiceChannelMembers: [],
      isMuted: false
    })
  },

  updateCurrentUser: (user) => set((state) => ({
    currentUser: state.currentUser ? { ...state.currentUser, ...user } : null
  })),

  // 频道相关
  channels: [],
  currentChannel: null,
  currentGroupId: null,

  setCurrentChannel: (channel) => set({ currentChannel: channel }),
  setCurrentGroupId: (groupId) => set({ currentGroupId: groupId }),
  setChannels: (channels) => set({ channels: Array.isArray(channels) ? channels : [] }),

  addChannel: (channel) => set((state) => ({
    channels: [...state.channels, channel]
  })),

  removeChannel: (channelId) => set((state) => ({
    channels: state.channels.filter(channel => channel.id !== channelId),
    currentChannel: state.currentChannel?.id === channelId ? null : state.currentChannel
  })),

  joinChannel: (channel) => set((state) => ({
    channels: [...state.channels, channel]
  })),

  leaveChannel: (channelId) => set((state) => ({
    channels: state.channels.filter(channel => channel.id !== channelId),
    currentChannel: state.currentChannel?.id === channelId ? null : state.currentChannel
  })),

  updateChannelCallStatus: (channelId, isInCall, callMembers) => set((state) => ({
    channels: state.channels.map(channel =>
      channel.id === channelId
        ? { ...channel, isInCall, callMembers }
        : channel
    )
  })),

  // 消息相关
  messages: [],

  addMessage: (message) => set((state) => {
    const currentMessages = Array.isArray(state.messages) ? state.messages : []
    const newMessages = [...currentMessages, message]
    newMessages.sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime()
      const dateB = new Date(b.createdAt).getTime()
      return dateA - dateB
    })
    return { messages: newMessages }
  }),

  setMessages: (messages) => set(() => {
    const validMessages = Array.isArray(messages) ? messages : []
    validMessages.sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime()
      const dateB = new Date(b.createdAt).getTime()
      return dateA - dateB
    })
    return { messages: validMessages }
  }),

  // 成员相关
  members: [],
  groupMembers: [],

  setMembers: (members) => set({ members }),
  setGroupMembers: (groupMembers) => set({ groupMembers }),

  updateMemberOnlineStatus: (memberId, isOnline) => set((state) => ({
    members: state.members.map((member) =>
      member.id === memberId ? { ...member, isOnline } : member
    ),
    groupMembers: state.groupMembers.map((member) =>
      member.id === memberId ? { ...member, isOnline } : member
    )
  })),

  updateMemberCallStatus: (memberId, isInCall) => set((state) => ({
    members: state.members.map((member) =>
      member.id === memberId ? { ...member, isInCall } : member
    )
  })),

  // 语音通话相关
  isInCall: false,
  isJoiningCall: false,
  voiceChannelMembers: [],
  isMuted: false,

  joinCall: () => set({ isInCall: true, isJoiningCall: false }),
  leaveCall: () => set({
    isInCall: false,
    isJoiningCall: false,
    voiceChannelMembers: [],
    isMuted: false
  }),

  toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),

  setVoiceChannelMembers: (members) => set({ voiceChannelMembers: members }),

  addVoiceChannelMember: (member) => set((state) => ({
    voiceChannelMembers: [...state.voiceChannelMembers.filter(m => m.id !== member.id), member]
  })),

  removeVoiceChannelMember: (memberId) => set((state) => ({
    voiceChannelMembers: state.voiceChannelMembers.filter(m => m.id !== memberId)
  }))
}))
```

- [ ] **Step 3: Commit store changes**

```bash
git add miniapp/src/store/useChatStore.ts miniapp/src/types/index.ts
git commit -m "feat(miniapp): extend store to match Web端 structure

- Add login with Taro.setStorage
- Add currentGroupId, groupMembers
- Add channel management: addChannel, removeChannel, joinChannel, leaveChannel
- Add updateChannelCallStatus, updateMemberCallStatus
- Add voice channel members management
- Add isMuted, toggleMute

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 5: Chat List Page

**Files:**
- Modify: `miniapp/src/pages/chat/index.tsx`
- Modify: `miniapp/src/pages/chat/index.config.ts`

- [ ] **Step 1: Update chat page config**

```typescript
// miniapp/src/pages/chat/index.config.ts
export default definePageConfig({
  navigationBarTitleText: '聊天'
})
```

- [ ] **Step 2: Update chat list page**

```typescript
// miniapp/src/pages/chat/index.tsx
import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useDidShow, useDidHide } from '@tarojs/taro'
import { useState, useEffect, useCallback } from 'react'
import { useChatStore } from '@/store/useChatStore'
import { useSocket } from '@/hooks/useSocket'
import { api } from '@/services/api'
import { joinChannel } from '@/services/socket'
import type { Channel, ChannelGroup } from '@/types'
import './index.scss'

export default function ChatPage() {
  const { channels, currentChannel, setCurrentChannel, setChannels, currentUser } = useChatStore()
  const { isConnected, connect, on, off } = useSocket()
  const [groups, setGroups] = useState<ChannelGroup[]>([])
  const [loading, setLoading] = useState(true)

  // 连接 WebSocket
  useEffect(() => {
    if (!isConnected) {
      connect()
    }
  }, [])

  // 监听 WebSocket 消息
  useEffect(() => {
    const handleChannelJoined = (data: any) => {
      console.log('Channel joined:', data)
    }

    const handleNewMessage = (data: any) => {
      console.log('New message:', data)
      // 可以显示通知或更新未读数
    }

    on('channel-joined', handleChannelJoined)
    on('new-message', handleNewMessage)

    return () => {
      off('channel-joined', handleChannelJoined)
      off('new-message', handleNewMessage)
    }
  }, [on, off])

  // 加载频道列表
  useDidShow(() => {
    loadChannels()
  })

  const loadChannels = async () => {
    setLoading(true)
    try {
      const res = await api.get<{ groups: ChannelGroup[] }>('/channels/groups')
      if (res.success && res.data) {
        setGroups(res.data.groups)
        
        // 扁平化所有频道
        const allChannels = res.data.groups.flatMap(g => g.channels)
        setChannels(allChannels)
      }
    } catch (e) {
      console.error('Load channels error:', e)
    } finally {
      setLoading(false)
    }
  }

  const handleChannelClick = (channel: Channel) => {
    setCurrentChannel(channel)
    joinChannel(channel.id)
    
    // 跳转到聊天详情页
    Taro.navigateTo({
      url: `/pages/detail/index?channelId=${channel.id}&channelName=${channel.name}`
    })
  }

  const renderChannel = (channel: Channel) => {
    const isVoice = channel.type === 'voice'
    
    return (
      <View
        key={channel.id}
        className="channel-item"
        onClick={() => handleChannelClick(channel)}
      >
        <View className="channel-icon">
          <Text className={`icon ${isVoice ? 'voice' : 'text'}`}>
            {isVoice ? '🔊' : '💬'}
          </Text>
        </View>
        <View className="channel-info">
          <Text className="channel-name">{channel.name}</Text>
          {channel.isInCall && (
            <Text className="call-status">{channel.callMembers} 人通话中</Text>
          )}
        </View>
        <View className="channel-arrow">
          <Text>›</Text>
        </View>
      </View>
    )
  }

  if (loading) {
    return (
      <View className="chat-page loading">
        <Text>加载中...</Text>
      </View>
    )
  }

  return (
    <View className="chat-page">
      <ScrollView scrollY className="channel-list">
        {groups.length === 0 ? (
          <View className="empty-state">
            <Text className="empty-text">暂无频道</Text>
            <Text className="empty-hint">请先在 Web 端加入频道</Text>
          </View>
        ) : (
          groups.map(group => (
            <View key={group.id} className="group-section">
              <View className="group-header">
                <Text className="group-name">{group.name}</Text>
              </View>
              <View className="group-channels">
                {group.channels.map(renderChannel)}
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <View className="connection-status">
        <View className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`} />
        <Text className="status-text">{isConnected ? '已连接' : '未连接'}</Text>
      </View>
    </View>
  )
}
```

- [ ] **Step 3: Create chat page styles**

```scss
// miniapp/src/pages/chat/index.scss
.chat-page {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: #f5f5f5;

  &.loading {
    justify-content: center;
    align-items: center;
  }
}

.channel-list {
  flex: 1;
  padding: 20px;
}

.group-section {
  margin-bottom: 30px;
}

.group-header {
  padding: 20px 0 10px;
}

.group-name {
  font-size: 28px;
  font-weight: bold;
  color: #333;
}

.group-channels {
  background: #fff;
  border-radius: 16px;
  overflow: hidden;
}

.channel-item {
  display: flex;
  align-items: center;
  padding: 24px 20px;
  border-bottom: 1px solid #f0f0f0;

  &:last-child {
    border-bottom: none;
  }

  &:active {
    background-color: #f9f9f9;
  }
}

.channel-icon {
  width: 80px;
  height: 80px;
  border-radius: 12px;
  background: #f0f0f0;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 20px;

  .icon {
    font-size: 36px;

    &.voice {
      // Voice icon style
    }

    &.text {
      // Text icon style
    }
  }
}

.channel-info {
  flex: 1;
}

.channel-name {
  font-size: 32px;
  color: #333;
  display: block;
}

.call-status {
  font-size: 24px;
  color: #10b981;
  margin-top: 8px;
  display: block;
}

.channel-arrow {
  color: #ccc;
  font-size: 32px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 100px 0;
}

.empty-text {
  font-size: 32px;
  color: #999;
}

.empty-hint {
  font-size: 24px;
  color: #bbb;
  margin-top: 16px;
}

.connection-status {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: #fff;
  border-top: 1px solid #eee;
}

.status-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  margin-right: 8px;

  &.connected {
    background-color: #10b981;
  }

  &.disconnected {
    background-color: #ef4444;
  }
}

.status-text {
  font-size: 24px;
  color: #666;
}
```

- [ ] **Step 4: Commit chat list page**

```bash
git add miniapp/src/pages/chat/
git commit -m "feat(miniapp): implement chat list page

- Display channel groups and channels
- WebSocket connection status indicator
- Navigate to detail on channel click
- Join channel via WebSocket

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 6: Chat Detail Page

**Files:**
- Create: `miniapp/src/pages/detail/index.tsx`
- Create: `miniapp/src/pages/detail/index.config.ts`
- Create: `miniapp/src/pages/detail/index.scss`
- Modify: `miniapp/src/app.config.ts`

- [ ] **Step 1: Add detail page to app.config.ts**

Add 'pages/detail/index' to pages array:

```typescript
export default defineAppConfig({
  pages: [
    'pages/index/index',
    'pages/chat/index',
    'pages/login/index',
    'pages/profile/index',
    'pages/detail/index'
  ],
  // ... rest of config
})
```

- [ ] **Step 2: Create detail page config**

```typescript
// miniapp/src/pages/detail/index.config.ts
export default definePageConfig({
  navigationBarTitleText: '聊天'
})
```

- [ ] **Step 3: Create detail page**

```typescript
// miniapp/src/pages/detail/index.tsx
import { View, Text, ScrollView, Input, Button } from '@tarojs/components'
import Taro, { useRouter, useReady } from '@tarojs/taro'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useChatStore } from '@/store/useChatStore'
import { useSocket } from '@/hooks/useSocket'
import { sendChatMessage, leaveChannel, onWebSocketMessage, offWebSocketMessage } from '@/services/socket'
import { api } from '@/services/api'
import type { Message, User } from '@/types'
import './index.scss'

export default function DetailPage() {
  const router = useRouter()
  const { channelId, channelName } = router.params
  
  const { messages, addMessage, setMessages, currentChannel, currentUser } = useChatStore()
  const { isConnected, on, off } = useSocket()
  
  const [inputValue, setInputValue] = useState('')
  const [loading, setLoading] = useState(true)
  const scrollViewRef = useRef<string>(`scroll-${Date.now()}`)
  
  // 加载历史消息
  useReady(() => {
    if (channelId) {
      loadMessages(Number(channelId))
    }
  })

  // 监听新消息
  useEffect(() => {
    const handleNewMessage = (data: any) => {
      if (data.channelId === Number(channelId)) {
        const message: Message = {
          id: data.id,
          content: data.content,
          sender: data.sender,
          createdAt: data.createdAt,
          isOwn: data.sender.id === currentUser?.id
        }
        addMessage(message)
      }
    }

    on('new-message', handleNewMessage)

    return () => {
      off('new-message', handleNewMessage)
    }
  }, [channelId, currentUser?.id, on, off, addMessage])

  // 离开页面时离开频道
  useEffect(() => {
    return () => {
      if (channelId) {
        leaveChannel(Number(channelId))
      }
    }
  }, [channelId])

  const loadMessages = async (id: number) => {
    setLoading(true)
    try {
      const res = await api.get<{ messages: Message[] }>(`/channels/${id}/messages`)
      if (res.success && res.data) {
        const processedMessages = res.data.messages.map(msg => ({
          ...msg,
          isOwn: msg.sender.id === currentUser?.id
        }))
        setMessages(processedMessages)
      }
    } catch (e) {
      console.error('Load messages error:', e)
    } finally {
      setLoading(false)
    }
  }

  const handleSend = () => {
    if (!inputValue.trim() || !channelId || !isConnected) {
      return
    }

    const content = {
      type: 'text',
      body: inputValue.trim()
    }

    sendChatMessage(Number(channelId), content)
    setInputValue('')
  }

  const formatTime = (date: Date | string) => {
    const d = new Date(date)
    const hours = d.getHours().toString().padStart(2, '0')
    const minutes = d.getMinutes().toString().padStart(2, '0')
    return `${hours}:${minutes}`
  }

  const renderMessage = (message: Message) => {
    const isOwn = message.isOwn || message.sender.id === currentUser?.id

    return (
      <View key={message.id} className={`message-item ${isOwn ? 'own' : 'other'}`}>
        {!isOwn && (
          <View className="avatar">
            <Text>{message.sender.username.charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <View className="message-content">
          {!isOwn && (
            <Text className="sender-name">{message.sender.username}</Text>
          )}
          <View className="message-bubble">
            <Text className="message-text">{message.content.body}</Text>
          </View>
          <Text className="message-time">{formatTime(message.createdAt)}</Text>
        </View>
        {isOwn && (
          <View className="avatar own-avatar">
            <Text>{currentUser?.username?.charAt(0)?.toUpperCase() || 'U'}</Text>
          </View>
        )}
      </View>
    )
  }

  return (
    <View className="detail-page">
      <View className="header">
        <Text className="title">{channelName || '聊天'}</Text>
        {!isConnected && (
          <View className="disconnected-badge">
            <Text>未连接</Text>
          </View>
        )}
      </View>

      <ScrollView
        className="message-list"
        scrollY
        scrollIntoView={scrollViewRef.current}
        scrollWithAnimation
      >
        {loading ? (
          <View className="loading-state">
            <Text>加载中...</Text>
          </View>
        ) : messages.length === 0 ? (
          <View className="empty-state">
            <Text>暂无消息</Text>
          </View>
        ) : (
          messages.map(renderMessage)
        )}
        <View id={scrollViewRef.current} />
      </ScrollView>

      <View className="input-area">
        <Input
          className="message-input"
          placeholder="输入消息..."
          value={inputValue}
          onInput={(e) => setInputValue(e.detail.value)}
          onConfirm={handleSend}
          confirmType="send"
        />
        <Button
          className="send-btn"
          onClick={handleSend}
          disabled={!inputValue.trim() || !isConnected}
        >
          发送
        </Button>
      </View>
    </View>
  )
}
```

- [ ] **Step 4: Create detail page styles**

```scss
// miniapp/src/pages/detail/index.scss
.detail-page {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: #f5f5f5;
}

.header {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: #fff;
  border-bottom: 1px solid #eee;
  position: relative;
}

.title {
  font-size: 32px;
  font-weight: bold;
  color: #333;
}

.disconnected-badge {
  position: absolute;
  right: 20px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 8px;
  padding: 4px 12px;

  text {
    font-size: 22px;
    color: #ef4444;
  }
}

.message-list {
  flex: 1;
  padding: 20px;
}

.message-item {
  display: flex;
  margin-bottom: 24px;

  &.own {
    flex-direction: row-reverse;

    .message-bubble {
      background: #6366f1;
      
      .message-text {
        color: #fff;
      }
    }

    .message-time {
      text-align: right;
    }
  }
}

.avatar {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: #e0e0e0;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  text {
    font-size: 28px;
    color: #666;
  }

  &.own-avatar {
    background: #6366f1;

    text {
      color: #fff;
    }
  }
}

.message-content {
  max-width: 70%;
  margin: 0 16px;
}

.sender-name {
  font-size: 24px;
  color: #666;
  margin-bottom: 8px;
  display: block;
}

.message-bubble {
  background: #fff;
  border-radius: 16px;
  padding: 16px 20px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.message-text {
  font-size: 28px;
  color: #333;
  word-break: break-all;
}

.message-time {
  font-size: 22px;
  color: #999;
  margin-top: 8px;
  display: block;
}

.loading-state,
.empty-state {
  display: flex;
  justify-content: center;
  padding: 100px 0;

  text {
    font-size: 28px;
    color: #999;
  }
}

.input-area {
  display: flex;
  align-items: center;
  padding: 16px 20px;
  background: #fff;
  border-top: 1px solid #eee;
  padding-bottom: calc(16px + env(safe-area-inset-bottom));
}

.message-input {
  flex: 1;
  background: #f5f5f5;
  border-radius: 24px;
  padding: 16px 24px;
  font-size: 28px;
}

.send-btn {
  margin-left: 16px;
  background: #6366f1;
  color: #fff;
  border-radius: 24px;
  padding: 16px 32px;
  font-size: 28px;
  border: none;

  &[disabled] {
    background: #ccc;
  }
}
```

- [ ] **Step 5: Commit detail page**

```bash
git add miniapp/src/pages/detail/ miniapp/src/app.config.ts
git commit -m "feat(miniapp): implement chat detail page

- Message list with own/other styling
- Send message via WebSocket
- Load history messages from API
- Leave channel on page unload

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 7: Update Profile Page

**Files:**
- Modify: `miniapp/src/pages/profile/index.tsx`

- [ ] **Step 1: Update profile page to use new store**

```typescript
// miniapp/src/pages/profile/index.tsx
import { View, Text, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useChatStore } from '@/store/useChatStore'
import { disconnectWebSocket } from '@/services/socket'
import './index.scss'

export default function ProfilePage() {
  const { currentUser, isAuthenticated, logout } = useChatStore()

  const handleLogout = async () => {
    disconnectWebSocket()
    await logout()
    Taro.redirectTo({ url: '/pages/login/index' })
  }

  if (!isAuthenticated || !currentUser) {
    return (
      <View className="profile-page">
        <View className="not-logged-in">
          <Text>请先登录</Text>
          <Button 
            className="login-btn"
            onClick={() => Taro.redirectTo({ url: '/pages/login/index' })}
          >
            去登录
          </Button>
        </View>
      </View>
    )
  }

  return (
    <View className="profile-page">
      <View className="profile-header">
        <View className="avatar">
          <Text>{currentUser.username.charAt(0).toUpperCase()}</Text>
        </View>
        <Text className="username">{currentUser.username}</Text>
        {currentUser.email && (
          <Text className="email">{currentUser.email}</Text>
        )}
      </View>

      <View className="profile-info">
        <View className="info-item">
          <Text className="label">用户ID</Text>
          <Text className="value">{currentUser.id}</Text>
        </View>
        <View className="info-item">
          <Text className="label">角色</Text>
          <Text className="value">{currentUser.role}</Text>
        </View>
        {currentUser.bio && (
          <View className="info-item">
            <Text className="label">简介</Text>
            <Text className="value">{currentUser.bio}</Text>
          </View>
        )}
      </View>

      <View className="actions">
        <Button className="logout-btn" onClick={handleLogout}>
          退出登录
        </Button>
      </View>
    </View>
  )
}
```

- [ ] **Step 2: Update profile styles**

```scss
// miniapp/src/pages/profile/index.scss
.profile-page {
  min-height: 100vh;
  background-color: #f5f5f5;
  padding: 40px;
}

.not-logged-in {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 100px 0;

  text {
    font-size: 32px;
    color: #999;
  }
}

.login-btn {
  margin-top: 40px;
  background: #6366f1;
  color: #fff;
  border-radius: 24px;
  padding: 20px 60px;
}

.profile-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px 0;
  background: #fff;
  border-radius: 16px;
  margin-bottom: 20px;
}

.avatar {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  background: #6366f1;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20px;

  text {
    font-size: 48px;
    color: #fff;
  }
}

.username {
  font-size: 36px;
  font-weight: bold;
  color: #333;
}

.email {
  font-size: 26px;
  color: #666;
  margin-top: 8px;
}

.profile-info {
  background: #fff;
  border-radius: 16px;
  padding: 20px;
  margin-bottom: 20px;
}

.info-item {
  display: flex;
  justify-content: space-between;
  padding: 20px 0;
  border-bottom: 1px solid #f0f0f0;

  &:last-child {
    border-bottom: none;
  }
}

.label {
  font-size: 28px;
  color: #666;
}

.value {
  font-size: 28px;
  color: #333;
}

.actions {
  padding: 40px 0;
}

.logout-btn {
  background: #ef4444;
  color: #fff;
  border-radius: 24px;
  padding: 24px;
  font-size: 32px;
}
```

- [ ] **Step 3: Commit profile page**

```bash
git add miniapp/src/pages/profile/
git commit -m "feat(miniapp): update profile page with new store

- Display user info from store
- Logout with WebSocket disconnect
- Handle unauthenticated state

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 8: Final Integration Test

- [ ] **Step 1: Build miniapp**

```bash
cd miniapp && npm run build:weapp
```

- [ ] **Step 2: Verify in WeChat DevTools**

1. Open WeChat DevTools
2. Import project from `miniapp/dist`
3. Test login flow
4. Test WebSocket connection (check console for [WS] logs)
5. Test channel list loading
6. Test entering channel and sending message
7. Test receiving message from another client (Web端)

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat(miniapp): complete Phase 2 WebSocket migration

- Config separation with defineConstants
- WebSocket core with auto-reconnect
- useSocket hook matching Web端
- Store extended to match Web端
- Chat list and detail pages
- Message send/receive working

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Summary

**Completed:**
1. ✅ Configuration separation (defineConstants)
2. ✅ WebSocket core module (socket.ts)
3. ✅ WebSocket hook (useSocket.ts)
4. ✅ Store extension (matching Web端)
5. ✅ Chat list page
6. ✅ Chat detail page
7. ✅ Profile page update
8. ✅ Integration test

**Next Phase (Phase 3):**
- Voice channel UI
- WeChat live-player/live-pusher for voice
- Voice signaling adaptation