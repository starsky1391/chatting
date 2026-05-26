# Web 聊天应用迁移微信小程序方案

## 📋 项目概述

将现有的 Next.js + Go 聊天应用迁移到微信小程序，采用 **Taro 框架**，保持 Web 端不变，实现双端并行。

### 技术栈对比

| 模块 | Web 端 | 小程序端 |
|------|--------|----------|
| 前端框架 | Next.js 14 + React | Taro 3 + React |
| UI 组件 | React DOM | Taro 组件 |
| 路由 | Next.js Router | Taro 路由 |
| 实时通信 | Socket.io | 原生 WebSocket |
| 音视频 | LiveKit | TRTC |
| 状态管理 | Zustand | Zustand（复用） |
| 类型定义 | TypeScript | TypeScript（复用） |
| 后端 | Go + Gin | Go + Gin（扩展） |

---

## 🏗️ 项目结构

### 整体目录结构

```
chatting/
├── frontend/              # Web 端（保持不变）
├── miniapp/               # 小程序端（新建）
├── backend-go/            # 后端（扩展）
├── shared/                # 共享代码（新建）
│   ├── types/            # TypeScript 类型定义
│   └── store/            # Zustand Store
└── MINIAPP_MIGRATION.md   # 本文档
```

### Taro 项目结构 (miniapp/)

```
miniapp/
├── config/                 # Taro 配置
│   ├── index.ts          # 主配置
│   ├── dev.ts            # 开发环境
│   └── prod.ts           # 生产环境
├── src/
│   ├── app.config.ts      # 小程序全局配置
│   ├── app.tsx            # 入口文件
│   ├── app.scss           # 全局样式
│   ├── pages/             # 页面
│   │   ├── index/         # 首页
│   │   │   ├── index.tsx
│   │   │   ├── index.scss
│   │   │   └── index.config.ts
│   │   ├── chat/          # 聊天页
│   │   │   ├── index.tsx
│   │   │   ├── index.scss
│   │   │   └── index.config.ts
│   │   ├── login/         # 登录页
│   │   └── profile/       # 个人中心
│   ├── components/        # 组件
│   │   ├── MessageItem/   # 消息项
│   │   ├── ChatInput/     # 聊天输入框
│   │   ├── VoiceCall/     # 语音通话
│   │   └── VideoCall/     # 视频通话
│   ├── services/          # API 服务
│   │   ├── api.ts        # HTTP 请求封装
│   │   ├── websocket.ts  # WebSocket 封装
│   │   └── trtc.ts       # TRTC 服务
│   ├── store/             # 状态管理（复用）
│   │   ├── useUserStore.ts
│   │   ├── useChatStore.ts
│   │   └── useCallStore.ts
│   ├── hooks/             # 自定义 Hooks
│   │   ├── useWebSocket.ts
│   │   └── useTRTC.ts
│   ├── types/             # 类型定义（复用）
│   │   └── index.ts
│   └── utils/             # 工具函数
│       ├── request.ts
│       ├── auth.ts
│       └── storage.ts
├── package.json
└── project.config.json    # 微信小程序配置
```

---

## 🔐 微信登录流程

### 流程图

```
小程序端                    后端                      微信服务器
   │                         │                           │
   ├─ wx.login()             │                           │
   │  获取 code              │                           │
   ├─────────────────────────>                           │
   │                         ├─ code2Session API         │
   │                         ├──────────────────────────>│
   │                         │                           │
   │                         │<─ session_key + openid    │
   │                         │                           │
   │<─ 返回 JWT Token         │                           │
   │                         │                           │
   ├─ 存储到本地             │                           │
   └─ 后续请求携带 Token      │                           │
```

### 代码实现

#### 1. 小程序端登录 (miniapp/src/pages/login/index.tsx)

```tsx
import { View, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState } from 'react'
import { api } from '@/services/api'
import { useUserStore } from '@/store/useUserStore'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const setUser = useUserStore(state => state.setUser)

  const handleWechatLogin = async () => {
    try {
      setLoading(true)
      
      // 1. 获取微信登录 code
      const { code } = await Taro.login()
      
      // 2. 发送到后端换取 token
      const res = await api.post('/auth/wechat/login', { code })
      
      // 3. 存储 token
      await Taro.setStorage({ key: 'token', data: res.data.token })
      await Taro.setStorage({ key: 'userInfo', data: res.data.user })
      
      // 4. 更新全局状态
      setUser(res.data.user)
      
      // 5. 跳转到首页
      Taro.switchTab({ url: '/pages/chat/index' })
      
    } catch (error) {
      Taro.showToast({ title: '登录失败', icon: 'error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <View className="login-page">
      <View className="login-header">
        <View className="logo">💬</View>
        <View className="title">在线聊天室</View>
      </View>
      
      <Button 
        className="login-btn"
        type="primary"
        loading={loading}
        onClick={handleWechatLogin}
      >
        微信一键登录
      </Button>
      
      <View className="tips">
        登录即表示同意《用户协议》和《隐私政策》
      </View>
    </View>
  )
}
```

#### 2. 后端微信登录接口 (backend-go/internal/service/wechat_service.go)

```go
package service

import (
    "encoding/json"
    "fmt"
    "net/http"
    "time"
    
    "github.com/gin-gonic/gin"
    "github.com/golang-jwt/jwt/v5"
)

type WechatLoginRequest struct {
    Code string `json:"code" binding:"required"`
}

type WechatLoginResponse struct {
    Token    string      `json:"token"`
    User     UserInfo    `json:"user"`
    IsNew    bool        `json:"isNew"`
}

type UserInfo struct {
    ID       uint   `json:"id"`
    Username string `json:"username"`
    Avatar   string `json:"avatar"`
}

type WechatSessionResponse struct {
    OpenID     string `json:"openid"`
    SessionKey string `json:"session_key"`
    UnionID    string `json:"unionid"`
    ErrCode    int    `json:"errcode"`
    ErrMsg     string `json:"errmsg"`
}

// WechatLogin 处理微信小程序登录
func (s *AuthService) WechatLogin(c *gin.Context) {
    var req WechatLoginRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "参数错误"})
        return
    }
    
    // 1. 调用微信 code2Session 接口
    sessionResp, err := s.getWechatSession(req.Code)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "微信登录失败"})
        return
    }
    
    if sessionResp.ErrCode != 0 {
        c.JSON(http.StatusBadRequest, gin.H{"error": sessionResp.ErrMsg})
        return
    }
    
    // 2. 查找或创建用户
    user, isNew, err := s.findOrCreateUserByOpenID(sessionResp.OpenID)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "用户创建失败"})
        return
    }
    
    // 3. 生成 JWT Token
    token, err := s.generateToken(user.ID)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Token 生成失败"})
        return
    }
    
    // 4. 返回响应
    c.JSON(http.StatusOK, WechatLoginResponse{
        Token: token,
        User: UserInfo{
            ID:       user.ID,
            Username: user.Username,
            Avatar:   user.Avatar,
        },
        IsNew: isNew,
    })
}

// getWechatSession 调用微信 code2Session 接口
func (s *AuthService) getWechatSession(code string) (*WechatSessionResponse, error) {
    url := fmt.Sprintf(
        "https://api.weixin.qq.com/sns/jscode2session?appid=%s&secret=%s&js_code=%s&grant_type=authorization_code",
        s.config.Wechat.AppID,
        s.config.Wechat.AppSecret,
        code,
    )
    
    resp, err := http.Get(url)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()
    
    var sessionResp WechatSessionResponse
    if err := json.NewDecoder(resp.Body).Decode(&sessionResp); err != nil {
        return nil, err
    }
    
    return &sessionResp, nil
}

// findOrCreateUserByOpenID 根据 OpenID 查找或创建用户
func (s *AuthService) findOrCreateUserByOpenID(openID string) (*model.User, bool, error) {
    // 查找 wechat_binding
    var binding model.WechatBinding
    result := s.db.Where("openid = ?", openID).First(&binding)
    
    if result.Error == nil {
        // 已存在，获取用户
        var user model.User
        if err := s.db.First(&user, binding.UserID).Error; err != nil {
            return nil, false, err
        }
        return &user, false, nil
    }
    
    // 不存在，创建新用户
    user := &model.User{
        Username: fmt.Sprintf("用户%s", openID[:8]),
        Avatar:   "/default-avatar.png",
    }
    
    if err := s.db.Create(user).Error; err != nil {
        return nil, false, err
    }
    
    // 创建绑定关系
    binding = model.WechatBinding{
        UserID: user.ID,
        OpenID: openID,
    }
    
    if err := s.db.Create(&binding).Error; err != nil {
        return nil, false, err
    }
    
    return user, true, nil
}
```

#### 3. 数据库模型 (backend-go/internal/model/model.go)

```go
// WechatBinding 微信账号绑定表
type WechatBinding struct {
    ID        uint      `gorm:"primaryKey" json:"id"`
    UserID    uint      `gorm:"not null;uniqueIndex" json:"user_id"`
    OpenID    string    `gorm:"size:64;not null;uniqueIndex" json:"openid"`
    UnionID   string    `gorm:"size:64" json:"unionid"`
    CreatedAt time.Time `json:"created_at"`
    UpdatedAt time.Time `json:"updated_at"`
    
    // 关联用户
    User      User      `gorm:"foreignKey:UserID" json:"user"`
}

func (WechatBinding) TableName() string {
    return "wechat_bindings"
}
```

---

## 📡 WebSocket 迁移

### Web 端 (Socket.io)

```typescript
// frontend/src/hooks/useSocket.ts
import { io, Socket } from 'socket.io-client'

const socket: Socket = io('ws://localhost:8080', {
  auth: { token: localStorage.getItem('token') }
})

socket.on('message', (data) => {
  console.log('收到消息:', data)
})
```

### 小程序端 (原生 WebSocket)

```typescript
// miniapp/src/hooks/useWebSocket.ts
import { useEffect, useRef } from 'react'
import Taro from '@tarojs/taro'

export function useWebSocket(url: string) {
  const socketRef = useRef<Taro.SocketTask | null>(null)
  
  const connect = async () => {
    const token = await Taro.getStorage({ key: 'token' })
    
    socketRef.current = Taro.connectSocket({
      url: `${url}?token=${token.data}`,
      success: () => console.log('WebSocket 连接成功'),
      fail: (err) => console.error('WebSocket 连接失败:', err)
    })
    
    socketRef.current.onOpen(() => {
      console.log('WebSocket 已打开')
    })
    
    socketRef.current.onMessage((res) => {
      const data = JSON.parse(res.data as string)
      // 处理消息
    })
    
    socketRef.current.onClose(() => {
      console.log('WebSocket 已关闭')
      // 重连逻辑
    })
    
    socketRef.current.onError((err) => {
      console.error('WebSocket 错误:', err)
    })
  }
  
  const send = (data: any) => {
    socketRef.current?.send({
      data: JSON.stringify(data)
    })
  }
  
  const close = () => {
    socketRef.current?.close()
  }
  
  useEffect(() => {
    connect()
    return () => close()
  }, [])
  
  return { send, close, reconnect: connect }
}
```

---

## 🎥 音视频双轨方案

### 架构设计

```
                    ┌─────────────┐
                    │   客户端    │
                    └──────┬──────┘
                           │
              ┌────────────┴────────────┐
              │                         │
        ┌─────▼─────┐             ┌─────▼─────┐
        │  Web 端   │             │  小程序端  │
        └─────┬─────┘             └─────┬─────┘
              │                         │
        ┌─────▼─────┐             ┌─────▼─────┐
        │  LiveKit  │             │   TRTC    │
        └─────┬─────┘             └─────┬─────┘
              │                         │
              └────────────┬────────────┘
                           │
                    ┌──────▼──────┐
                    │  后端抽象层  │
                    └─────────────┘
```

### 后端统一接口 (backend-go/internal/service/call_service.go)

```go
package service

type CallService struct {
    livekit *LiveKitService
    trtc    *TRTCService
}

type CreateCallRequest struct {
    RoomID   string `json:"roomId"`
    CallType string `json:"callType"` // "audio" | "video"
    Platform string `json:"platform"` // "web" | "miniapp"
}

type CreateCallResponse struct {
    RoomID    string `json:"roomId"`
    Token     string `json:"token"`
    ServerURL string `json:"serverUrl"`
}

// CreateCall 创建通话房间
func (s *CallService) CreateCall(req CreateCallRequest) (*CreateCallResponse, error) {
    if req.Platform == "web" {
        // Web 端使用 LiveKit
        return s.livekit.CreateRoom(req.RoomID, req.CallType)
    } else {
        // 小程序使用 TRTC
        return s.trtc.CreateRoom(req.RoomID, req.CallType)
    }
}
```

### TRTC 服务 (backend-go/internal/service/trtc_service.go)

```go
package service

import (
    "encoding/hex"
    "fmt"
    "time"
    
    "github.com/tencentyun/tls-sig-api-v2-golang/tls_sig_api"
)

type TRTCService struct {
    sdkAppID    uint32
    sdkAppKey   string
    expireTime  uint64
}

func NewTRTCService(sdkAppID uint32, sdkAppKey string) *TRTCService {
    return &TRTCService{
        sdkAppID:   sdkAppID,
        sdkAppKey:  sdkAppKey,
        expireTime: 86400, // 24小时
    }
}

// GenUserSig 生成 UserSig
func (s *TRTCService) GenUserSig(userID string) (string, error) {
    gen := tls_sig_api.NewTLSSigAPI(s.sdkAppID, s.sdkAppKey)
    sig, err := gen.GenSig(userID, s.expireTime)
    if err != nil {
        return "", err
    }
    return sig, nil
}

// CreateRoom 创建 TRTC 房间
func (s *TRTCService) CreateRoom(roomID string, callType string) (*CreateCallResponse, error) {
    // TRTC 不需要预先创建房间，只需要生成 UserSig
    return &CreateCallResponse{
        RoomID:    roomID,
        ServerURL: fmt.Sprintf("wss://rtc.trtc.tencent-cloud.com"),
        Token:     "", // UserSig 由客户端生成
    }, nil
}
```

### 小程序端 TRTC Hook (miniapp/src/hooks/useTRTC.ts)

```typescript
import { useEffect, useRef, useState } from 'react'
import TRTC from 'trtc-sdk-wx'
import Taro from '@tarojs/taro'

interface TRTCConfig {
  sdkAppID: number
  userID: string
  userSig: string
  roomID: number
}

export function useTRTC() {
  const trtcRef = useRef<any>(null)
  const [isEntered, setIsEntered] = useState(false)
  const [localStream, setLocalStream] = useState<any>(null)
  const [remoteStreams, setRemoteStreams] = useState<any[]>([])
  
  // 初始化 TRTC
  const init = async (config: TRTCConfig) => {
    trtcRef.current = new TRTC()
    
    // 监听事件
    trtcRef.current.on(TRTC.EVENT.ERROR, (error: any) => {
      console.error('TRTC 错误:', error)
    })
    
    trtcRef.current.on(TRTC.EVENT.REMOTE_USER_ENTER, (event: any) => {
      console.log('远程用户进入:', event.userID)
    })
    
    trtcRef.current.on(TRTC.EVENT.REMOTE_VIDEO_AVAILABLE, (event: any) => {
      console.log('远程视频可用:', event)
      setRemoteStreams(prev => [...prev, event])
    })
    
    trtcRef.current.on(TRTC.EVENT.REMOTE_USER_LEAVE, (event: any) => {
      console.log('远程用户离开:', event.userID)
      setRemoteStreams(prev => prev.filter(s => s.userID !== event.userID))
    })
    
    // 进入房间
    await trtcRef.current.enterRoom({
      sdkAppId: config.sdkAppID,
      userId: config.userID,
      userSig: config.userSig,
      roomId: config.roomID,
    })
    
    setIsEntered(true)
  }
  
  // 开启/关闭本地摄像头
  const startLocalVideo = async () => {
    const stream = await trtcRef.current.startLocalVideo()
    setLocalStream(stream)
    return stream
  }
  
  const stopLocalVideo = () => {
    trtcRef.current.stopLocalVideo()
    setLocalStream(null)
  }
  
  // 开启/关闭本地麦克风
  const startLocalAudio = () => {
    trtcRef.current.startLocalAudio()
  }
  
  const stopLocalAudio = () => {
    trtcRef.current.stopLocalAudio()
  }
  
  // 退出房间
  const exitRoom = async () => {
    await trtcRef.current.exitRoom()
    setIsEntered(false)
    setLocalStream(null)
    setRemoteStreams([])
  }
  
  // 清理
  useEffect(() => {
    return () => {
      if (trtcRef.current) {
        trtcRef.current.destroy()
      }
    }
  }, [])
  
  return {
    init,
    isEntered,
    localStream,
    remoteStreams,
    startLocalVideo,
    stopLocalVideo,
    startLocalAudio,
    stopLocalAudio,
    exitRoom,
  }
}
```

---

## 📦 共享代码

### 类型定义 (shared/types/index.ts)

```typescript
// 消息类型
export interface Message {
  id: string
  conversationId: string
  senderId: string
  content: string
  type: 'text' | 'image' | 'audio' | 'video'
  createdAt: Date
  updatedAt: Date
}

// 用户类型
export interface User {
  id: string
  username: string
  avatar: string
  email?: string
  phone?: string
  status: 'online' | 'offline' | 'busy'
}

// 会话类型
export interface Conversation {
  id: string
  type: 'private' | 'group'
  name?: string
  avatar?: string
  participants: User[]
  lastMessage?: Message
  unreadCount: number
  createdAt: Date
  updatedAt: Date
}

// 通话类型
export interface Call {
  id: string
  type: 'audio' | 'video'
  status: 'calling' | 'connected' | 'ended'
  caller: User
  callee: User
  roomId: string
  startTime?: Date
  endTime?: Date
  duration?: number
}
```

### Zustand Store (shared/store/useChatStore.ts)

```typescript
import { create } from 'zustand'

interface ChatState {
  conversations: Conversation[]
  currentConversation: Conversation | null
  messages: Message[]
  
  // Actions
  setConversations: (conversations: Conversation[]) => void
  setCurrentConversation: (conversation: Conversation | null) => void
  addMessage: (message: Message) => void
  updateMessage: (id: string, updates: Partial<Message>) => void
}

export const useChatStore = create<ChatState>((set) => ({
  conversations: [],
  currentConversation: null,
  messages: [],
  
  setConversations: (conversations) => set({ conversations }),
  setCurrentConversation: (conversation) => set({ currentConversation: conversation }),
  addMessage: (message) => set((state) => ({
    messages: [...state.messages, message]
  })),
  updateMessage: (id, updates) => set((state) => ({
    messages: state.messages.map(msg =>
      msg.id === id ? { ...msg, ...updates } : msg
    )
  })),
}))
```

---

## 🗄️ 数据库迁移

### SQL 脚本 (docker/mysql/migrations/add_wechat_binding.sql)

```sql
-- 微信账号绑定表
CREATE TABLE IF NOT EXISTS wechat_bindings (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL COMMENT '用户ID',
    openid VARCHAR(64) NOT NULL COMMENT '微信OpenID',
    unionid VARCHAR(64) DEFAULT NULL COMMENT '微信UnionID',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY idx_user_id (user_id),
    UNIQUE KEY idx_openid (openid),
    UNIQUE KEY idx_unionid (unionid),
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='微信账号绑定表';

-- 添加索引
CREATE INDEX idx_wechat_bindings_created_at ON wechat_bindings(created_at);
```

---

## 🚀 开发计划

### 第一阶段：基础架构（第 1-2 周）

- [ ] 初始化 Taro 项目
- [ ] 配置项目结构和依赖
- [ ] 搭建共享代码目录
- [ ] 后端添加微信登录接口
- [ ] 数据库添加 wechat_bindings 表

### 第二阶段：核心功能（第 3-4 周）

- [ ] 实现微信登录流程
- [ ] 迁移 WebSocket 连接
- [ ] 实现消息收发功能
- [ ] 实现会话列表
- [ ] 实现聊天详情页

### 第三阶段：音视频功能（第 5-6 周）

- [ ] 集成 TRTC SDK
- [ ] 实现语音通话
- [ ] 实现视频通话
- [ ] 后端 TRTC 服务开发

### 第四阶段：优化和测试（第 7-8 周）

- [ ] UI/UX 优化
- [ ] 性能优化
- [ ] 错误处理
- [ ] 测试和修复 Bug
- [ ] 提交审核

---

## 📝 配置文件

### Taro 配置 (miniapp/config/index.ts)

```typescript
const config = {
  projectName: 'chatting-miniapp',
  date: '2025-1-11',
  designWidth: 750,
  deviceRatio: {
    640: 2.34 / 2,
    750: 1,
    828: 1.81 / 2
  },
  sourceRoot: 'src',
  outputRoot: 'dist',
  plugins: [],
  defineConstants: {},
  copy: {
    patterns: [],
    options: {}
  },
  framework: 'react',
  compiler: {
    type: 'webpack5',
    prebundle: { enable: false }
  },
  mini: {
    postcss: {
      pxtransform: {
        enable: true,
        config: {}
      },
      cssModules: {
        enable: false,
        config: {
          namingPattern: 'module',
          generateScopedName: '[name]__[local]___[hash:base64:5]'
        }
      }
    }
  }
}

module.exports = function (merge) {
  if (process.env.NODE_ENV === 'development') {
    return merge({}, config, require('./dev'))
  }
  return merge({}, config, require('./prod'))
}
```

### 微信小程序配置 (miniapp/project.config.json)

```json
{
  "miniprogramRoot": "dist/",
  "projectname": "chatting-miniapp",
  "description": "在线聊天室小程序",
  "appid": "your-app-id",
  "setting": {
    "urlCheck": false,
    "es6": false,
    "enhance": false,
    "compileHotReLoad": false,
    "postcss": false,
    "minified": false
  },
  "compileType": "miniprogram"
}
```

---

## 🔧 环境变量

### 后端环境变量 (.env)

```bash
# 微信小程序配置
WECHAT_APP_ID=your_wechat_appid
WECHAT_APP_SECRET=your_wechat_appsecret

# TRTC 配置
TRTC_SDK_APP_ID=your_trtc_sdk_appid
TRTC_SDK_APP_KEY=your_trtc_sdk_appkey

# 数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASS=password
DB_NAME=chatting
```

### 小程序环境变量 (miniapp/.env)

```bash
# API 地址
API_BASE_URL=https://api.example.com
WS_URL=wss://ws.example.com

# TRTC 配置
TRTC_SDK_APP_ID=your_trtc_sdk_appid
```

---

## 📚 参考文档

- [Taro 官方文档](https://taro-docs.jd.com/)
- [微信小程序开发文档](https://developers.weixin.qq.com/miniprogram/dev/framework/)
- [TRTC 小程序 SDK](https://cloud.tencent.com/document/product/647/32183)
- [LiveKit 文档](https://docs.livekit.io/)
- [Zustand 文档](https://github.com/pmndrs/zustand)

---

## 🤝 贡献指南

1. Web 端代码修改在 `frontend/` 目录
2. 小程序端代码修改在 `miniapp/` 目录
3. 共享代码修改在 `shared/` 目录
4. 后端代码修改在 `backend-go/` 目录
5. 提交前请确保测试通过

---

## 📄 License

MIT
