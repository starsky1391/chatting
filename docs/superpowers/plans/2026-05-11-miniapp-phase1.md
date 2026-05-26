# 第一阶段：基础架构实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完成微信小程序迁移第一阶段基础架构，包括共享代码目录、后端微信登录接口、数据库迁移和小程序端登录完善。

**Architecture:** 采用分层架构，后端新增微信登录服务和控制器，数据库新增 wechat_bindings 表关联用户与微信账号，小程序端完善用户状态管理和登录流程。

**Tech Stack:** Go + Gin + GORM + PostgreSQL（后端），Taro 3 + React + Zustand + TypeScript（小程序）

---

## 文件结构

### 新建文件

| 文件路径 | 职责 |
|---------|------|
| `shared/package.json` | 共享包配置 |
| `shared/tsconfig.json` | TypeScript 配置 |
| `shared/types/index.ts` | 类型定义统一导出 |
| `shared/types/user.ts` | 用户类型定义 |
| `shared/types/message.ts` | 消息类型定义 |
| `shared/types/api.ts` | API 响应类型 |
| `shared/store/index.ts` | Store 统一导出 |
| `shared/store/useUserStore.ts` | 用户状态管理 |
| `backend-go/internal/model/wechat_binding.go` | 微信绑定模型 |
| `backend-go/internal/service/wechat_service.go` | 微信登录服务 |
| `backend-go/internal/controller/wechat_controller.go` | 微信登录控制器 |

### 修改文件

| 文件路径 | 修改内容 |
|---------|---------|
| `backend-go/internal/config/config.go` | 添加 WechatConfig |
| `backend-go/internal/model/database.go` | AutoMigrate 添加 WechatBinding |
| `backend-go/internal/repository/repository.go` | 添加 WechatBindingRepository |
| `backend-go/internal/router/router.go` | 添加微信登录路由 |
| `backend-go/.env.example` | 添加微信配置示例 |
| `miniapp/src/services/wechat.ts` | 微信登录服务封装 |
| `miniapp/src/pages/login/index.tsx` | 对接真实后端 |

---

## Task 1: 创建 shared 目录和类型定义

**Files:**
- Create: `shared/package.json`
- Create: `shared/tsconfig.json`
- Create: `shared/types/user.ts`
- Create: `shared/types/message.ts`
- Create: `shared/types/api.ts`
- Create: `shared/types/index.ts`

- [ ] **Step 1: 创建 shared 目录结构**

```bash
mkdir -p "C:/1Project/project_web/chatting/shared/types"
mkdir -p "C:/1Project/project_web/chatting/shared/store"
```

- [ ] **Step 2: 创建 shared/package.json**

```json
{
  "name": "@chatting/shared",
  "version": "1.0.0",
  "private": true,
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  },
  "dependencies": {
    "zustand": "^4.5.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0"
  }
}
```

- [ ] **Step 3: 创建 shared/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "declaration": true,
    "declarationMap": true,
    "outDir": "./dist",
    "rootDir": ".",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["types/**/*", "store/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 4: 创建 shared/types/user.ts**

```typescript
export interface User {
  id: number
  username: string
  email?: string
  avatar: string
  avatarUrl?: string
  role: 'admin' | 'moderator' | 'member'
  bio?: string
  isOnline: boolean
  lastSeen?: string | null
}

export interface WechatLoginRequest {
  code: string
}

export interface WechatLoginResponse {
  accessToken: string
  user: User
  isNew: boolean
}
```

- [ ] **Step 5: 创建 shared/types/message.ts**

```typescript
export interface Message {
  id: number
  content: {
    type: string
    body: string
  }
  sender: {
    id: number
    username: string
    avatar: string
    avatarUrl?: string
  }
  createdAt: string
}

export interface Channel {
  id: number
  name: string
  type: 'text' | 'voice'
  groupId?: number
  description?: string
  position?: number
}

export interface ChannelGroup {
  id: number
  name: string
  description?: string
  icon?: string
  ownerId: number
  inviteCode: string
  channels: Channel[]
}
```

- [ ] **Step 6: 创建 shared/types/api.ts**

```typescript
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface AuthResponse {
  accessToken: string
  user: import('./user').User
}
```

- [ ] **Step 7: 创建 shared/types/index.ts**

```typescript
export * from './user'
export * from './message'
export * from './api'
```

- [ ] **Step 8: 提交**

```bash
cd "C:/1Project/project_web/chatting"
git add shared/
git commit -m "$(cat <<'EOF'
feat: 创建 shared 共享代码目录

- 添加类型定义 (User, Message, Channel, ApiResponse)
- 配置 TypeScript 编译
- 为 frontend 和 miniapp 复用做准备

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: 创建 shared 用户状态管理 Store

**Files:**
- Create: `shared/store/useUserStore.ts`
- Create: `shared/store/index.ts`

- [ ] **Step 1: 创建 shared/store/useUserStore.ts**

```typescript
import { create } from 'zustand'
import type { User } from '../types/user'

interface UserState {
  user: User | null
  token: string | null
  isLoggedIn: boolean
  setUser: (user: User) => void
  setToken: (token: string) => void
  logout: () => void
  initFromStorage: () => Promise<void>
}

export const useUserStore = create<UserState>((set) => ({
  user: null,
  token: null,
  isLoggedIn: false,

  setUser: (user) => set({ user, isLoggedIn: true }),

  setToken: (token) => set({ token }),

  logout: () => {
    set({ user: null, token: null, isLoggedIn: false })
  },

  initFromStorage: async () => {
    // 此方法由各端实现，因为存储 API 不同
    // Web 端使用 localStorage
    // 小程序端使用 Taro.getStorage
  }
}))

// 小程序端存储实现
export const initUserFromMiniappStorage = async () => {
  const Taro = require('@tarojs/taro')
  try {
    const tokenRes = await Taro.getStorage({ key: 'token' })
    const userRes = await Taro.getStorage({ key: 'userInfo' })
    if (tokenRes.data && userRes.data) {
      useUserStore.getState().setToken(tokenRes.data)
      useUserStore.getState().setUser(userRes.data)
    }
  } catch {
    // 未登录
  }
}

// 保存到小程序存储
export const saveUserToMiniappStorage = async (token: string, user: User) => {
  const Taro = require('@tarojs/taro')
  await Taro.setStorage({ key: 'token', data: token })
  await Taro.setStorage({ key: 'userInfo', data: user })
}

// 清除小程序存储
export const clearUserFromMiniappStorage = async () => {
  const Taro = require('@tarojs/taro')
  await Taro.removeStorage({ key: 'token' })
  await Taro.removeStorage({ key: 'userInfo' })
}
```

- [ ] **Step 2: 创建 shared/store/index.ts**

```typescript
export { useUserStore, initUserFromMiniappStorage, saveUserToMiniappStorage, clearUserFromMiniappStorage } from './useUserStore'
```

- [ ] **Step 3: 提交**

```bash
cd "C:/1Project/project_web/chatting"
git add shared/store/
git commit -m "$(cat <<'EOF'
feat: 添加 useUserStore 用户状态管理

- 用户信息、token、登录状态管理
- 小程序端存储辅助函数

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: 后端添加微信配置

**Files:**
- Modify: `backend-go/internal/config/config.go`
- Modify: `backend-go/.env.example`

- [ ] **Step 1: 修改 config.go 添加 WechatConfig**

在 `backend-go/internal/config/config.go` 中，在 `Config` 结构体中添加 `Wechat` 字段：

找到第 10-18 行的 Config 结构体，修改为：

```go
type Config struct {
	Port        string
	Database    DatabaseConfig
	JWT         JWTConfig
	Redis       RedisConfig
	RabbitMQ    RabbitMQConfig
	LogLevel    string
	AllowedOrigins []string
	Wechat      WechatConfig  // 新增
}

type WechatConfig struct {
	AppID     string
	AppSecret string
}
```

在文件末尾（第 100 行后）添加微信配置读取：

```go
// Wechat config
cfg.Wechat.AppID = viper.GetString("WECHAT_APP_ID")
cfg.Wechat.AppSecret = viper.GetString("WECHAT_APP_SECRET")
```

- [ ] **Step 2: 修改 .env.example 添加微信配置示例**

在 `backend-go/.env.example` 文件末尾添加：

```bash
# Wechat Mini Program Config
WECHAT_APP_ID=your_wechat_appid
WECHAT_APP_SECRET=your_wechat_appsecret
```

- [ ] **Step 3: 提交**

```bash
cd "C:/1Project/project_web/chatting"
git add backend-go/internal/config/config.go backend-go/.env.example
git commit -m "$(cat <<'EOF'
feat: 后端添加微信小程序配置

- Config 结构体添加 WechatConfig
- .env.example 添加 WECHAT_APP_ID 和 WECHAT_APP_SECRET

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: 后端添加 WechatBinding 数据模型

**Files:**
- Create: `backend-go/internal/model/wechat_binding.go`
- Modify: `backend-go/internal/model/database.go`

- [ ] **Step 1: 创建 wechat_binding.go**

```go
package model

import (
	"time"

	"gorm.io/gorm"
)

// WechatBinding 微信账号绑定表
type WechatBinding struct {
	gorm.Model
	UserID  uint   `gorm:"not null;uniqueIndex" json:"user_id"`
	OpenID  string `gorm:"size:64;not null;uniqueIndex" json:"openid"`
	UnionID string `gorm:"size:64" json:"unionid"`

	// 关联用户
	User User `gorm:"foreignKey:UserID" json:"user"`
}

func (WechatBinding) TableName() string {
	return "wechat_bindings"
}

// WechatBindingResponse 微信绑定响应
type WechatBindingResponse struct {
	ID        uint      `json:"id"`
	UserID    uint      `json:"userId"`
	OpenID    string    `json:"openid"`
	CreatedAt time.Time `json:"createdAt"`
}
```

- [ ] **Step 2: 修改 database.go 的 AutoMigrate**

在 `backend-go/internal/model/database.go` 的 `AutoMigrate` 函数中添加 `&WechatBinding{}`：

找到第 37-45 行，修改为：

```go
func AutoMigrate(db *gorm.DB) error {
	err := db.AutoMigrate(
		&User{},
		&ChannelGroup{},
		&Channel{},
		&Message{},
		&UserChannel{},
		&UserGroup{},
		&WechatBinding{},  // 新增
	)
	if err != nil {
		return fmt.Errorf("failed to migrate database: %w", err)
	}

	log.Println("Database migrated successfully")
	return nil
}
```

- [ ] **Step 3: 提交**

```bash
cd "C:/1Project/project_web/chatting"
git add backend-go/internal/model/wechat_binding.go backend-go/internal/model/database.go
git commit -m "$(cat <<'EOF'
feat: 添加 WechatBinding 数据模型

- 新增 wechat_binding.go 定义微信账号绑定表
- AutoMigrate 添加 WechatBinding 自动建表

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: 后端添加 WechatBindingRepository

**Files:**
- Modify: `backend-go/internal/repository/repository.go`

- [ ] **Step 1: 在 repository.go 末尾添加 WechatBindingRepository**

在 `backend-go/internal/repository/repository.go` 文件末尾添加：

```go
type WechatBindingRepository struct {
	db *gorm.DB
}

func NewWechatBindingRepository(db *gorm.DB) *WechatBindingRepository {
	return &WechatBindingRepository{db: db}
}

func (r *WechatBindingRepository) Create(binding *model.WechatBinding) error {
	return r.db.Create(binding).Error
}

func (r *WechatBindingRepository) FindByOpenID(openID string) (*model.WechatBinding, error) {
	var binding model.WechatBinding
	err := r.db.Preload("User").Where("openid = ?", openID).First(&binding).Error
	return &binding, err
}

func (r *WechatBindingRepository) FindByUserID(userID uint) (*model.WechatBinding, error) {
	var binding model.WechatBinding
	err := r.db.Where("user_id = ?", userID).First(&binding).Error
	return &binding, err
}

func (r *WechatBindingRepository) Delete(userID uint) error {
	return r.db.Where("user_id = ?", userID).Delete(&model.WechatBinding{}).Error
}
```

- [ ] **Step 2: 提交**

```bash
cd "C:/1Project/project_web/chatting"
git add backend-go/internal/repository/repository.go
git commit -m "$(cat <<'EOF'
feat: 添加 WechatBindingRepository 数据访问层

- Create, FindByOpenID, FindByUserID, Delete 方法

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: 后端添加微信登录服务

**Files:**
- Create: `backend-go/internal/service/wechat_service.go`

- [ ] **Step 1: 创建 wechat_service.go**

```go
package service

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"

	"chat-backend/internal/config"
	"chat-backend/internal/model"
	"chat-backend/internal/repository"

	"gorm.io/gorm"
)

type WechatService struct {
	userRepo    *repository.UserRepository
	bindingRepo *repository.WechatBindingRepository
	cfg         *config.Config
}

func NewWechatService(userRepo *repository.UserRepository, bindingRepo *repository.WechatBindingRepository, cfg *config.Config) *WechatService {
	return &WechatService{
		userRepo:    userRepo,
		bindingRepo: bindingRepo,
		cfg:         cfg,
	}
}

type WechatLoginInput struct {
	Code string `json:"code" binding:"required"`
}

type WechatLoginResponse struct {
	AccessToken string             `json:"accessToken"`
	User        model.UserResponse `json:"user"`
	IsNew       bool               `json:"isNew"`
}

type WechatSessionResponse struct {
	OpenID     string `json:"openid"`
	SessionKey string `json:"session_key"`
	UnionID    string `json:"unionid"`
	ErrCode    int    `json:"errcode"`
	ErrMsg     string `json:"errmsg"`
}

// Login 处理微信小程序登录
func (s *WechatService) Login(input WechatLoginInput) (*WechatLoginResponse, error) {
	// 1. 调用微信 code2Session 接口
	sessionResp, err := s.getWechatSession(input.Code)
	if err != nil {
		return nil, fmt.Errorf("微信登录失败: %w", err)
	}

	if sessionResp.ErrCode != 0 {
		return nil, fmt.Errorf("微信登录失败: %s", sessionResp.ErrMsg)
	}

	// 2. 查找或创建用户
	user, isNew, err := s.findOrCreateUserByOpenID(sessionResp.OpenID)
	if err != nil {
		return nil, fmt.Errorf("用户创建失败: %w", err)
	}

	// 3. 返回响应
	return &WechatLoginResponse{
		User:  model.ToUserResponse(*user),
		IsNew: isNew,
	}, nil
}

// getWechatSession 调用微信 code2Session 接口
func (s *WechatService) getWechatSession(code string) (*WechatSessionResponse, error) {
	url := fmt.Sprintf(
		"https://api.weixin.qq.com/sns/jscode2session?appid=%s&secret=%s&js_code=%s&grant_type=authorization_code",
		s.cfg.Wechat.AppID,
		s.cfg.Wechat.AppSecret,
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
func (s *WechatService) findOrCreateUserByOpenID(openID string) (*model.User, bool, error) {
	// 查找 wechat_binding
	binding, err := s.bindingRepo.FindByOpenID(openID)
	if err == nil && binding.ID != 0 {
		// 已存在，获取用户
		user, err := s.userRepo.FindByID(binding.UserID)
		if err != nil {
			return nil, false, err
		}
		return user, false, nil
	}

	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, false, err
	}

	// 不存在，创建新用户
	user := &model.User{
		Username: fmt.Sprintf("用户%s", openID[:8]),
		Avatar:   "默",
		Role:     "member",
		IsOnline: true,
	}

	if err := s.userRepo.Create(user); err != nil {
		return nil, false, err
	}

	// 创建绑定关系
	binding = &model.WechatBinding{
		UserID: user.ID,
		OpenID: openID,
	}

	if err := s.bindingRepo.Create(binding); err != nil {
		return nil, false, err
	}

	return user, true, nil
}
```

- [ ] **Step 2: 提交**

```bash
cd "C:/1Project/project_web/chatting"
git add backend-go/internal/service/wechat_service.go
git commit -m "$(cat <<'EOF'
feat: 添加微信登录服务

- WechatService 处理微信小程序登录
- 调用微信 code2Session API
- 根据 OpenID 查找或创建用户

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: 后端添加微信登录控制器

**Files:**
- Create: `backend-go/internal/controller/wechat_controller.go`

- [ ] **Step 1: 创建 wechat_controller.go**

```go
package controller

import (
	"chat-backend/internal/config"
	"chat-backend/internal/middleware"
	"chat-backend/internal/service"
	"chat-backend/pkg/response"

	"github.com/gin-gonic/gin"
)

type WechatController struct {
	wechatService *service.WechatService
	cfg           *config.Config
}

func NewWechatController(wechatService *service.WechatService, cfg *config.Config) *WechatController {
	return &WechatController{
		wechatService: wechatService,
		cfg:           cfg,
	}
}

// Login 处理微信小程序登录
func (c *WechatController) Login(ctx *gin.Context) {
	var input service.WechatLoginInput
	if err := ctx.ShouldBindJSON(&input); err != nil {
		response.BadRequest(ctx, "参数错误: "+err.Error())
		return
	}

	result, err := c.wechatService.Login(input)
	if err != nil {
		response.Error(ctx, 400, err.Error())
		return
	}

	// Generate token
	token, err := middleware.GenerateToken(result.User.ID, result.User.Username, c.cfg)
	if err != nil {
		response.InternalError(ctx, "Failed to generate token")
		return
	}
	result.AccessToken = token

	response.Success(ctx, result)
}
```

- [ ] **Step 2: 提交**

```bash
cd "C:/1Project/project_web/chatting"
git add backend-go/internal/controller/wechat_controller.go
git commit -m "$(cat <<'EOF'
feat: 添加微信登录控制器

- WechatController 处理 /api/auth/wechat/login 请求
- 生成 JWT token 返回给小程序

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: 后端注册微信登录路由

**Files:**
- Modify: `backend-go/internal/router/router.go`

- [ ] **Step 1: 修改 router.go 添加微信登录路由**

在 `backend-go/internal/router/router.go` 中：

1. 在 import 部分添加 controller 包（已有）

2. 在 `Setup` 函数中，找到 `auth := api.Group("/auth")` 部分（约第 82-86 行），修改为：

```go
// Auth routes (public)
auth := api.Group("/auth")
{
	auth.POST("/register", authController.Register)
	auth.POST("/login", authController.Login)
	auth.POST("/wechat/login", wechatController.Login)  // 新增
}
```

3. 在 `Setup` 函数开头，初始化 wechatController。找到初始化 controllers 的位置（约第 36-39 行后），添加：

```go
// Initialize repositories
userRepo := repository.NewUserRepository(db)
groupRepo := repository.NewChannelGroupRepository(db)
channelRepo := repository.NewChannelRepository(db)
messageRepo := repository.NewMessageRepository(db)
_ = repository.NewUserChannelRepository(db) // Reserved for future use
userGroupRepo := repository.NewUserGroupRepository(db)
wechatBindingRepo := repository.NewWechatBindingRepository(db)  // 新增

// Initialize services
authService := service.NewAuthService(userRepo, cfg, redisClient)
groupService := service.NewChannelGroupService(groupRepo, channelRepo, userGroupRepo, redisClient)
messageService := service.NewMessageService(messageRepo, userRepo)
wechatService := service.NewWechatService(userRepo, wechatBindingRepo, cfg)  // 新增

// Initialize controllers
authController := controller.NewAuthController(authService, cfg)
groupController := controller.NewChannelGroupController(groupService)
messageController := controller.NewMessageController(messageService)
wechatController := controller.NewWechatController(wechatService, cfg)  // 新增
```

- [ ] **Step 2: 提交**

```bash
cd "C:/1Project/project_web/chatting"
git add backend-go/internal/router/router.go
git commit -m "$(cat <<'EOF'
feat: 注册微信登录路由

- POST /api/auth/wechat/login 微信小程序登录接口
- 初始化 WechatBindingRepository, WechatService, WechatController

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: 小程序端添加微信登录服务

**Files:**
- Create: `miniapp/src/services/wechat.ts`

- [ ] **Step 1: 创建 wechat.ts**

```typescript
import Taro from '@tarojs/taro'
import { api } from './api'
import type { WechatLoginResponse } from '@/types'

export const wechatService = {
  /**
   * 微信小程序登录
   * 1. 调用 wx.login 获取 code
   * 2. 发送 code 到后端换取 token
   */
  async login(): Promise<WechatLoginResponse> {
    // 1. 获取微信登录 code
    const { code } = await Taro.login()

    if (!code) {
      throw new Error('获取微信登录 code 失败')
    }

    // 2. 发送到后端换取 token
    const res = await api.post<WechatLoginResponse>('/auth/wechat/login', { code })

    if (!res.success || !res.data) {
      throw new Error(res.error || '登录失败')
    }

    return res.data
  },

  /**
   * 检查是否已登录
   */
  async isLoggedIn(): Promise<boolean> {
    try {
      const token = await Taro.getStorage({ key: 'token' })
      return !!token.data
    } catch {
      return false
    }
  },

  /**
   * 获取存储的用户信息
   */
  async getStoredUser() {
    try {
      const user = await Taro.getStorage({ key: 'userInfo' })
      return user.data
    } catch {
      return null
    }
  },

  /**
   * 退出登录
   */
  async logout() {
    await Taro.removeStorage({ key: 'token' })
    await Taro.removeStorage({ key: 'userInfo' })
  }
}
```

- [ ] **Step 2: 更新 miniapp/src/types/index.ts 添加 WechatLoginResponse**

在 `miniapp/src/types/index.ts` 文件末尾添加：

```typescript
// 微信登录响应类型
export interface WechatLoginResponse {
  accessToken: string
  user: User
  isNew: boolean
}
```

- [ ] **Step 3: 提交**

```bash
cd "C:/1Project/project_web/chatting"
git add miniapp/src/services/wechat.ts miniapp/src/types/index.ts
git commit -m "$(cat <<'EOF'
feat: 小程序端添加微信登录服务

- wechatService 封装登录、登出、检查登录状态
- 添加 WechatLoginResponse 类型

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: 小程序端完善登录页面

**Files:**
- Modify: `miniapp/src/pages/login/index.tsx`
- Create: `miniapp/src/store/useUserStore.ts`

- [ ] **Step 1: 创建 miniapp/src/store/useUserStore.ts**

```typescript
import { create } from 'zustand'
import type { User } from '@/types'

interface UserState {
  user: User | null
  token: string | null
  isLoggedIn: boolean
  setUser: (user: User) => void
  setToken: (token: string) => void
  logout: () => void
}

export const useUserStore = create<UserState>((set) => ({
  user: null,
  token: null,
  isLoggedIn: false,

  setUser: (user) => set({ user, isLoggedIn: true }),

  setToken: (token) => set({ token }),

  logout: () => set({ user: null, token: null, isLoggedIn: false })
}))
```

- [ ] **Step 2: 修改登录页面**

将 `miniapp/src/pages/login/index.tsx` 替换为：

```tsx
import { View, Button, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState } from 'react'
import { wechatService } from '@/services/wechat'
import { useUserStore } from '@/store/useUserStore'
import './index.scss'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const setUser = useUserStore(state => state.setUser)
  const setToken = useUserStore(state => state.setToken)

  const handleWechatLogin = async () => {
    try {
      setLoading(true)

      // 调用微信登录服务
      const result = await wechatService.login()

      // 存储到本地
      await Taro.setStorage({ key: 'token', data: result.accessToken })
      await Taro.setStorage({ key: 'userInfo', data: result.user })

      // 更新全局状态
      setToken(result.accessToken)
      setUser(result.user)

      // 新用户提示
      if (result.isNew) {
        await Taro.showToast({ title: '欢迎加入！', icon: 'success' })
      }

      // 跳转到聊天页
      Taro.switchTab({ url: '/pages/chat/index' })

    } catch (error: any) {
      console.error('登录失败:', error)
      Taro.showToast({
        title: error.message || '登录失败',
        icon: 'error'
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <View className='login-page'>
      <View className='login-header'>
        <View className='logo'>💬</View>
        <View className='title'>在线聊天室</View>
        <View className='subtitle'>随时随地，畅快聊天</View>
      </View>

      <View className='login-content'>
        <Button
          className='login-btn'
          type='primary'
          loading={loading}
          onClick={handleWechatLogin}
        >
          微信一键登录
        </Button>
      </View>

      <View className='login-footer'>
        <View className='tips'>
          登录即表示同意
          <Text className='link'>《用户协议》</Text>
          和
          <Text className='link'>《隐私政策》</Text>
        </View>
      </View>
    </View>
  )
}
```

- [ ] **Step 3: 提交**

```bash
cd "C:/1Project/project_web/chatting"
git add miniapp/src/store/useUserStore.ts miniapp/src/pages/login/index.tsx
git commit -m "$(cat <<'EOF'
feat: 完善小程序登录页面

- 创建 useUserStore 用户状态管理
- 登录页对接真实后端接口
- 支持新用户提示

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: 更新 app.tsx 使用 useUserStore

**Files:**
- Modify: `miniapp/src/app.tsx`

- [ ] **Step 1: 修改 app.tsx**

将 `miniapp/src/app.tsx` 替换为：

```tsx
import { Component } from 'react'
import Taro from '@tarojs/taro'
import { useUserStore } from './store/useUserStore'
import './app.scss'

class App extends Component {
  componentDidMount() {
    this.checkLoginStatus()
  }

  checkLoginStatus = async () => {
    try {
      const tokenRes = await Taro.getStorage({ key: 'token' })
      const userRes = await Taro.getStorage({ key: 'userInfo' })

      if (tokenRes.data && userRes.data) {
        // 已登录，恢复状态
        useUserStore.getState().setToken(tokenRes.data)
        useUserStore.getState().setUser(userRes.data)

        // 跳转到聊天页
        Taro.switchTab({ url: '/pages/chat/index' })
      } else {
        // 未登录，跳转到登录页
        Taro.redirectTo({ url: '/pages/login/index' })
      }
    } catch {
      // 未登录
      Taro.redirectTo({ url: '/pages/login/index' })
    }
  }

  render() {
    return this.props.children
  }
}

export default App
```

- [ ] **Step 2: 提交**

```bash
cd "C:/1Project/project_web/chatting"
git add miniapp/src/app.tsx
git commit -m "$(cat <<'EOF'
feat: 更新 app.tsx 使用 useUserStore

- 启动时恢复用户登录状态
- 使用 Zustand 管理全局用户状态

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: 验证和测试

**Files:**
- 无新建文件

- [ ] **Step 1: 编译后端检查语法错误**

```bash
cd "C:/1Project/project_web/chatting/backend-go"
go build -o test_build.exe ./cmd/server
```

Expected: 编译成功，无错误

- [ ] **Step 2: 编译小程序检查语法错误**

```bash
cd "C:/1Project/project_web/chatting/miniapp"
npm run build:weapp
```

Expected: 编译成功，无错误

- [ ] **Step 3: 最终提交**

```bash
cd "C:/1Project/project_web/chatting"
git add -A
git status
```

确认所有更改已提交。

---

## 验收标准

- [ ] 后端编译通过
- [ ] 小程序编译通过
- [ ] 数据库迁移成功（wechat_bindings 表创建）
- [ ] POST /api/auth/wechat/login 接口可访问
- [ ] 小程序登录页可调用后端接口
