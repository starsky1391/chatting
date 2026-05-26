# 第一阶段：基础架构设计

## 概述

将现有的 Next.js + Go 聊天应用扩展微信小程序支持，第一阶段完成基础架构搭建，包括共享代码目录、后端微信登录接口、数据库迁移和小程序端完善。

## 目标

- [x] 初始化 Taro 项目（已完成）
- [x] 配置项目结构和依赖（已完成）
- [ ] 搭建共享代码目录
- [ ] 后端添加微信登录接口
- [ ] 数据库添加 wechat_bindings 表
- [ ] 小程序端完善登录流程

---

## 一、共享代码目录

### 目录结构

```
chatting/
├── shared/                    # 新建共享代码目录
│   ├── package.json          # 独立包配置
│   ├── tsconfig.json         # TypeScript 配置
│   ├── types/                # 类型定义
│   │   ├── index.ts          # 统一导出
│   │   ├── user.ts           # 用户相关类型
│   │   ├── message.ts        # 消息相关类型
│   │   ├── conversation.ts   # 会话相关类型
│   │   └── api.ts            # API 响应类型
│   └── store/                # Zustand Store
│       ├── index.ts          # 统一导出
│       ├── useUserStore.ts   # 用户状态
│       └── useChatStore.ts   # 聊天状态
```

### 设计要点

- `shared/` 作为独立 npm 包，frontend 和 miniapp 通过 workspace 引用
- 类型定义与后端 Go 结构体保持一致
- Store 使用 Zustand，两端可复用

---

## 二、后端微信登录

### 新增文件

```
backend-go/
├── internal/
│   ├── config/
│   │   └── config.go         # 添加 WechatConfig 结构体
│   ├── controller/
│   │   └── wechat_controller.go  # 新增：微信登录控制器
│   ├── service/
│   │   └── wechat_service.go     # 新增：微信登录服务
│   ├── model/
│   │   └── model.go          # 添加 WechatBinding 模型
│   └── router/
│       └── router.go         # 添加微信登录路由
```

### API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/wechat/login` | 微信小程序登录 |

**请求体：**
```json
{ "code": "微信登录code" }
```

**响应体：**
```json
{
  "accessToken": "jwt_token",
  "user": { "id": 1, "username": "用户xxx", "avatar": "..." },
  "isNew": true
}
```

### 登录流程

1. 小程序调用 `wx.login()` 获取 code
2. 小程序发送 code 到后端 `/api/auth/wechat/login`
3. 后端调用微信 `code2Session` API 获取 openid
4. 后端根据 openid 查找或创建用户
5. 后端生成 JWT token 返回

### 配置项

```bash
# .env 新增配置
WECHAT_APP_ID=your_wechat_appid
WECHAT_APP_SECRET=your_wechat_appsecret
```

---

## 三、数据库迁移

### 新增表：wechat_bindings

```sql
CREATE TABLE wechat_bindings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    openid VARCHAR(64) NOT NULL UNIQUE,
    unionid VARCHAR(64),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_wechat_bindings_user_id ON wechat_bindings(user_id);
```

### Go 模型定义

```go
type WechatBinding struct {
    gorm.Model
    UserID  uint   `gorm:"not null;uniqueIndex"`
    OpenID  string `gorm:"size:64;not null;uniqueIndex"`
    UnionID string `gorm:"size:64"`
    User    User   `gorm:"foreignKey:UserID"`
}
```

### 设计要点

- 一个用户只能绑定一个微信账号（user_id 唯一）
- 一个微信账号只能绑定一个用户（openid 唯一）
- 支持后续 UnionID 跨小程序关联

---

## 四、小程序端完善

### 新增/修改文件

```
miniapp/src/
├── store/
│   └── useUserStore.ts       # 新增：用户状态管理
├── services/
│   ├── api.ts                # 已有，保持不变
│   └── wechat.ts             # 新增：微信登录服务封装
├── types/
│   └── index.ts              # 新增：类型定义（从 shared 复制或引用）
└── pages/login/
    └── index.tsx             # 修改：对接真实后端接口
```

### useUserStore 设计

```typescript
interface UserState {
  user: User | null
  token: string | null
  isLoggedIn: boolean
  // Actions
  setUser: (user: User) => void
  setToken: (token: string) => void
  logout: () => void
  initFromStorage: () => Promise<void>
}
```

### 登录页改动

- 移除模拟登录逻辑
- 调用真实后端 `/api/auth/wechat/login`
- 使用 useUserStore 管理状态
- 处理新用户引导（可选）

---

## 五、实现顺序

1. **创建 shared/ 目录结构** - 类型定义和 Store
2. **后端配置扩展** - 添加微信配置项
3. **数据库模型** - 添加 WechatBinding 模型
4. **后端服务层** - 实现 wechat_service.go
5. **后端控制器** - 实现 wechat_controller.go
6. **路由注册** - 添加微信登录路由
7. **小程序端** - 完善 useUserStore 和登录页

---

## 六、测试验证

- [ ] 后端单元测试：微信登录服务
- [ ] 后端集成测试：完整登录流程
- [ ] 小程序端测试：微信开发者工具中测试登录
- [ ] 数据库验证：确认 wechat_bindings 表正确创建
