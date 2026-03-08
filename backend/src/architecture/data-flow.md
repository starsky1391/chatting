# 模块间数据流转文档

## 1. 安全模块数据流转

### 1.1 认证流程

```
客户端 → POST /api/auth/login → AuthController.login() → AuthService.login() → JWTUtil.generateTokens() → 返回双Token
```

1. **客户端**：发送登录请求，包含邮箱和密码
2. **AuthController**：验证请求参数，调用AuthService.login()
3. **AuthService**：验证用户凭证，调用JWTUtil.generateTokens()生成双Token
4. **JWTUtil**：生成accessToken（15分钟有效期）和refreshToken（7天有效期）
5. **返回**：返回用户信息和双Token

### 1.2 令牌刷新流程

```
客户端 → POST /api/auth/refresh → AuthController.refreshToken() → AuthService.refreshToken() → JWTUtil.refreshToken() → 返回新的accessToken
```

1. **客户端**：发送刷新Token请求，包含refreshToken
2. **AuthController**：验证请求参数，调用AuthService.refreshToken()
3. **AuthService**：调用JWTUtil.refreshToken()刷新令牌
4. **JWTUtil**：验证refreshToken，生成新的accessToken
5. **返回**：返回新的accessToken

### 1.3 Socket.io连接鉴权流程

```
客户端 → Socket.io连接请求 → socketAuthMiddleware → JWTUtil.verifyToken() → 连接建立
```

1. **客户端**：发送Socket.io连接请求，携带accessToken
2. **socketAuthMiddleware**：从连接参数中获取token，调用JWTUtil.verifyToken()
3. **JWTUtil**：验证token的有效性和类型
4. **连接建立**：验证通过后，将用户信息添加到socket对象中，建立连接

## 2. 性能模块数据流转

### 2.1 在线状态管理流程

```
Socket.io连接 → onlineStatusManager.setUserOnline() → Redis
Socket.io断开 → onlineStatusManager.setUserOffline() → Redis
```

1. **Socket.io连接**：用户连接时，调用onlineStatusManager.setUserOnline()
2. **onlineStatusManager**：将用户状态存储到Redis的Hash和Set中
3. **Redis**：存储用户在线状态
4. **Socket.io断开**：用户断开连接时，调用onlineStatusManager.setUserOffline()
5. **onlineStatusManager**：更新用户状态为离线

### 2.2 频道成员管理流程

```
加入频道 → onlineStatusManager.addUserToChannel() → Redis
离开频道 → onlineStatusManager.removeUserFromChannel() → Redis
```

1. **加入频道**：用户加入频道时，调用onlineStatusManager.addUserToChannel()
2. **onlineStatusManager**：将用户添加到频道的成员集合，将频道添加到用户的频道集合
3. **Redis**：存储频道成员关系
4. **离开频道**：用户离开频道时，调用onlineStatusManager.removeUserFromChannel()
5. **onlineStatusManager**：从频道的成员集合中移除用户，从用户的频道集合中移除频道

## 3. 数据模块数据流转

### 3.1 消息创建流程

```
客户端 → POST /api/channels/:id/messages → MessageController.createMessage() → MessageService.createMessage() → messageQueue.sendMessage() → RabbitMQ
```

1. **客户端**：发送创建消息请求，包含消息内容
2. **MessageController**：验证请求参数，调用MessageService.createMessage()
3. **MessageService**：调用messageQueue.sendMessage()将消息发送到RabbitMQ
4. **messageQueue**：将消息发送到RabbitMQ队列
5. **RabbitMQ**：存储消息，等待消费者处理

### 3.2 消息消费流程

```
RabbitMQ → messageQueue.startConsumer() → messageRepository.createMessage() → PostgreSQL
```

1. **RabbitMQ**：消息队列中的消息
2. **messageQueue**：消费者从队列中获取消息
3. **messageRepository**：将消息写入数据库
4. **PostgreSQL**：存储消息数据

### 3.3 消息查询流程

```
客户端 → GET /api/channels/:id/messages → MessageController.getMessagesByChannelId() → MessageService.getMessagesByChannelId() → messageRepository.getMessagesByChannelId() → PostgreSQL
```

1. **客户端**：发送获取消息请求，包含频道ID和分页参数
2. **MessageController**：验证请求参数，调用MessageService.getMessagesByChannelId()
3. **MessageService**：调用messageRepository.getMessagesByChannelId()
4. **messageRepository**：从数据库中查询消息，支持基于时间戳的分页
5. **PostgreSQL**：返回消息数据
6. **返回**：返回消息列表

## 4. 可靠性模块数据流转

### 4.1 消息队列流程

```
MessageService → messageQueue.sendMessage() → rabbitmqClient.sendMessage() → RabbitMQ
```

1. **MessageService**：调用messageQueue.sendMessage()
2. **messageQueue**：准备消息数据，调用rabbitmqClient.sendMessage()
3. **rabbitmqClient**：连接到RabbitMQ，发送消息到队列
4. **RabbitMQ**：存储消息，确保消息不丢失

### 4.2 消息消费流程

```
RabbitMQ → rabbitmqClient.consumeMessages() → messageQueue回调 → messageRepository.createMessage() → PostgreSQL
```

1. **RabbitMQ**：消息队列中的消息
2. **rabbitmqClient**：消费者从队列中获取消息
3. **messageQueue**：处理消息，调用messageRepository.createMessage()
4. **messageRepository**：将消息写入数据库
5. **PostgreSQL**：存储消息数据

## 5. 配置管理模块数据流转

### 5.1 配置加载流程

```
应用启动 → dotenv.config() → config/index.ts → 各模块使用配置
```

1. **应用启动**：应用启动时加载环境变量
2. **dotenv.config()**：从.env文件加载环境变量
3. **config/index.ts**：读取环境变量，提供统一的配置接口
4. **各模块**：从config模块获取配置

## 6. 模块间集成数据流转

### 6.1 完整消息流程

```
客户端 → Socket.io发送消息 → 服务器接收消息 → MessageService.createMessage() → messageQueue.sendMessage() → RabbitMQ → 消费者处理 → messageRepository.createMessage() → PostgreSQL → Socket.io广播消息
```

1. **客户端**：通过Socket.io发送消息
2. **服务器**：接收消息事件
3. **MessageService**：调用createMessage()处理消息
4. **messageQueue**：将消息发送到RabbitMQ
5. **RabbitMQ**：存储消息
6. **消费者**：从队列中获取消息，处理并写入数据库
7. **PostgreSQL**：存储消息数据
8. **Socket.io**：广播消息到频道中的所有客户端

### 6.2 用户在线状态流程

```
客户端 → Socket.io连接 → socketAuthMiddleware验证 → onlineStatusManager.setUserOnline() → Redis → 广播用户上线通知
```

1. **客户端**：建立Socket.io连接
2. **socketAuthMiddleware**：验证token，确保连接安全
3. **onlineStatusManager**：设置用户在线状态
4. **Redis**：存储用户在线状态
5. **Socket.io**：广播用户上线通知

## 7. 数据流转图

```
+-------------+     +---------------+     +-------------+     +---------------+
|  客户端      | --> |  安全模块      | --> |  业务逻辑    | --> |  可靠性模块    |
+-------------+     +---------------+     +-------------+     +---------------+
                        ^                        |                        |
                        |                        v                        v
                        |                +-------------+     +---------------+
                        |                |  性能模块    | <-- |  RabbitMQ     |
                        |                +-------------+     +---------------+
                        |                        |                        |
                        |                        v                        |
                        +---------------+-------------+     +---------------+
                                        |  数据模块    | --> |  PostgreSQL   |
                                        +-------------+     +---------------+
```

## 8. 关键数据结构

### 8.1 JWT Token结构

```json
{
  "userId": 1,
  "username": "testuser",
  "type": "access",
  "iat": 1678900000,
  "exp": 1678900900
}
```

### 8.2 消息结构

```json
{
  "id": 1,
  "content": "Hello world",
  "sender": {
    "id": 1,
    "username": "testuser",
    "avatar": "https://via.placeholder.com/40"
  },
  "channelId": 1,
  "metadata": {
    "type": "text",
    "attachments": []
  },
  "createdAt": "2026-03-05T10:00:00Z",
  "updatedAt": "2026-03-05T10:00:00Z"
}
```

### 8.3 Redis数据结构

- **users:online** (Hash): 存储用户在线状态
- **online:users** (Set): 存储在线用户ID
- **channel:{channelId}:members** (Set): 存储频道成员
- **user:{userId}:channels** (Set): 存储用户加入的频道

### 8.4 RabbitMQ消息结构

```json
{
  "content": "Hello world",
  "senderId": 1,
  "channelId": 1,
  "metadata": {
    "type": "text",
    "attachments": []
  },
  "timestamp": 1678900000000
}
```

## 9. 性能优化点

1. **Redis缓存**：使用Redis存储在线状态和频道成员，减少数据库查询
2. **异步处理**：使用RabbitMQ异步处理消息写入，提高响应速度
3. **分页查询**：基于时间戳的分页查询，避免全表扫描
4. **索引优化**：数据库索引优化，提高查询性能
5. **连接池**：使用数据库连接池，减少连接开销

## 10. 可靠性保障

1. **消息持久化**：RabbitMQ消息持久化，确保消息不丢失
2. **队列持久化**：RabbitMQ队列持久化，确保队列不丢失
3. **自动重连**：Redis和RabbitMQ自动重连机制
4. **错误处理**：完善的错误处理和重试机制
5. **数据一致性**：确保消息最终一致性

## 11. 安全保障

1. **双Token认证**：accessToken和refreshToken分离，提高安全性
2. **Token过期**：设置合理的Token过期时间
3. **Socket.io鉴权**：确保Socket连接安全
4. **数据验证**：严格的输入验证，防止恶意输入
5. **HTTPS**：使用HTTPS加密传输

## 12. 扩展性考虑

1. **水平扩展**：Socket.io Redis适配器支持多服务器部署
2. **模块化设计**：各模块职责清晰，便于独立扩展
3. **配置管理**：环境变量分离，支持不同环境部署
4. **服务发现**：为后续微服务架构做准备
5. **监控告警**：便于系统监控和故障排查
