# Phase 2: WebSocket Migration Design Spec

> **Goal:** Migrate WebSocket functionality from Web to Miniapp, enabling real-time messaging, voice channel support, and conversation management.

**Architecture:** Taro.connectSocket for mini-program WebSocket, Zustand store matching Web端 structure, message handlers subscription pattern for event routing.

**Tech Stack:** Taro 3 + React, gorilla/websocket (backend), Zustand (state), defineConstants (config)

---

## 1. Configuration Separation

### Problem
Miniapp currently has hardcoded API URL: `'http://localhost:3001/api'`

### Solution
Use Taro's `defineConstants` for environment-based configuration.

**Files:**
- Modify: `miniapp/config/index.ts` - add defineConstants
- Modify: `miniapp/config/dev.ts` - dev environment constants
- Modify: `miniapp/config/prod.ts` - prod environment constants
- Modify: `miniapp/src/services/api.ts` - use `API_BASE_URL` constant
- Create: `miniapp/src/config/index.ts` - centralized config exports

**Config Structure:**
```typescript
// config/index.ts
const config = {
  dev: {
    defineConstants: {
      API_BASE_URL: '"http://localhost:3001/api"',
      WS_BASE_URL: '"ws://localhost:3001/ws"'
    }
  },
  prod: {
    defineConstants: {
      API_BASE_URL: '"https://api.example.com/api"',
      WS_BASE_URL: '"wss://api.example.com/ws"'
    }
  }
}
```

**Usage:**
```typescript
// src/config/index.ts
export const API_BASE_URL = process.env.API_BASE_URL
export const WS_BASE_URL = process.env.WS_BASE_URL
```

---

## 2. WebSocket Core Module

### Architecture (Matching Web端)

**Web端 Structure:**
- `socket.ts`: Core WebSocket connection, message handlers Map, auto-reconnect
- `useSocket.ts`: Hook exposing connect, disconnect, emit, on, off, once

**Miniapp Structure:**
- `socket.ts`: Taro.connectSocket wrapper, message handlers Map, reconnect logic
- `useSocket.ts`: Hook matching Web端 interface

### socket.ts Design

**Exports:**
- `connectWebSocket(token)` - establish connection with auth
- `disconnectWebSocket()` - close connection
- `sendWebSocketMessage(type, payload)` - send message
- `onWebSocketMessage(type, handler)` - subscribe to message type
- `offWebSocketMessage(type, handler)` - unsubscribe
- `isConnected()` - connection status
- `getSocket()` - get raw socket instance

**Message Handlers Pattern:**
```typescript
const messageHandlers = new Map<string, Set<(data: any) => void>>()

// On message received
socket.onMessage((res) => {
  const msg = JSON.parse(res.data)
  const handlers = messageHandlers.get(msg.type)
  handlers?.forEach(handler => handler(msg.payload))
})
```

**Reconnect Logic:**
- MAX_RECONNECT_ATTEMPTS = 5
- RECONNECT_DELAY = 2000ms
- Exponential backoff optional

### useSocket.ts Design

**Interface (Matching Web端):**
```typescript
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
```

---

## 3. Store Extension (Matching Web端)

### Current Miniapp Store Missing Features

**Missing from Web端:**
- `login(user, token)` - Web端 saves to localStorage, miniapp uses Taro.setStorage
- `currentGroupId` - for group context
- `setCurrentGroupId`
- `addChannel` - add single channel
- `removeChannel` - remove channel
- `joinChannel` - alias for addChannel
- `leaveChannel` - alias for removeChannel
- `updateChannelCallStatus` - update voice channel status
- `groupMembers` - separate group member list
- `setGroupMembers`
- `updateMemberCallStatus`
- `isJoiningCall` - joining state
- `localStream` / `remoteStreams` - WebRTC streams (miniapp uses different approach)
- `setLocalStream` / `addRemoteStream` / `removeRemoteStream`
- `toggleMute`
- Sidebar states (not needed for miniapp)

### Miniapp-Specific Adaptations

**Storage:**
- Replace `localStorage` with `Taro.setStorage/getStorage`

**Voice Streams:**
- Miniapp doesn't support MediaStream directly
- Use WeChat's live-player/live-pusher components for voice
- Store voice state differently: `voiceChannelMembers` instead of `remoteStreams`

**Sidebar:**
- Remove sidebar states (miniapp has fixed navigation)

### Updated Store Interface

```typescript
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
  voiceChannelMembers: Member[]  // 替代 remoteStreams
  joinCall: () => void
  leaveCall: () => void
  toggleMute: () => void
  setVoiceChannelMembers: (members: Member[]) => void
  addVoiceChannelMember: (member: Member) => void
  removeVoiceChannelMember: (memberId: number) => void
}
```

---

## 4. Message Types (Backend Alignment)

**Backend Message Types (from handler.go):**
- `heartbeat` - connection keepalive
- `join-channel` - join text/voice channel
- `leave-channel` - leave channel
- `send-message` - send chat message
- `voice:join` - join voice call
- `voice:leave` - leave voice call
- `voice:signal` - WebRTC signaling (miniapp uses different approach)

**Miniapp Handling:**
- `heartbeat`: Auto-send every 30s
- `join-channel`: On channel selection
- `leave-channel`: On channel switch/logout
- `send-message`: On user send
- `voice:join/leave`: For voice channels (signaling adapted for WeChat)

---

## 5. File Structure

```
miniapp/src/
├── config/
│   └── index.ts          # Centralized config exports
├── services/
│   ├── api.ts            # HTTP API (modified for defineConstants)
│   └── socket.ts         # WebSocket core (new)
├── hooks/
│   ├── useSocket.ts      # WebSocket hook (new)
│   └── useAuth.ts        # Auth hook (existing)
├── store/
│   └── useChatStore.ts   # Extended store
├── types/
│   └── index.ts          # Types (extended)
├── pages/
│   ├── chat/
│   │   └── index.tsx     # Chat list page
│   │   └── index.config.ts
│   └── detail/
│   │   └── index.tsx     # Chat detail page (new)
│   │   └── index.config.ts
│   └── profile/
│   │   └── index.tsx     # Profile page (existing)
```

---

## 6. Implementation Order

1. **Config Separation** - defineConstants setup
2. **WebSocket Core** - socket.ts with handlers pattern
3. **WebSocket Hook** - useSocket.ts matching Web端
4. **Store Extension** - add missing methods, adapt for miniapp
5. **Chat List Page** - display channels/conversations
6. **Chat Detail Page** - message display, send functionality
7. **Voice Channel UI** - voice call interface (Phase 3)

---

## 7. Testing Strategy

- Manual testing in WeChat DevTools
- WebSocket connection with backend
- Message send/receive verification
- Reconnection behavior
- Voice channel join/leave (Phase 3)