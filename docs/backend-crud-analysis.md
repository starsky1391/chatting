# Chatting 后端核心增删查改（CRUD）代码分析

## 目录

1. [项目结构概述](#项目结构概述)
2. [数据模型层（Model）](#数据模型层model)
3. [数据访问层（Repository）](#数据访问层repository)
4. [业务逻辑层（Service）](#业务逻辑层service)
5. [接口控制层（Controller）](#接口控制层controller)
6. [CRUD 操作总结](#crud-操作总结)

---

## 项目结构概述

Chatting 后端采用经典的 **三层架构**：

```
backend-go/internal/
├── model/          # 数据模型层
├── repository/     # 数据访问层（CRUD 操作）
├── service/        # 业务逻辑层
├── controller/     # 接口控制层（HTTP 接口）
├── router/         # 路由配置
├── middleware/      # 中间件
└── config/         # 配置管理
```

**技术栈**：
- **Web 框架**：Gin
- **ORM**：GORM
- **数据库**：PostgreSQL
- **缓存**：Redis
- **认证**：JWT

---

## 数据模型层（Model）

**文件**：`backend-go/internal/model/model.go`

### 核心数据模型

```go
// User 用户模型
type User struct {
    gorm.Model
    Username  string `json:"username" gorm:"not null"`
    Email     string `json:"email" gorm:"uniqueIndex;not null"`
    Password  string `json:"-" gorm:"not null"`
    Avatar    string `json:"avatar"`
    AvatarURL string `json:"avatarUrl"`
    Role      string `json:"role" gorm:"default:'member'"`
    Bio       string `json:"bio"`
    LastSeen  *time.Time `json:"lastSeen"`
    IsOnline  bool       `json:"isOnline" gorm:"default:false"`
}

// ChannelGroup 频道组模型
type ChannelGroup struct {
    gorm.Model
    Name        string    `json:"name" gorm:"not null"`
    Description string    `json:"description"`
    Icon        string    `json:"icon"`
    OwnerID     uint      `json:"ownerId"`
    Owner       User      `json:"owner"`
    InviteCode  string    `json:"inviteCode" gorm:"size:12;uniqueIndex"`
    Channels    []Channel `json:"channels" gorm:"foreignKey:GroupID"`
}

// Channel 频道模型
type Channel struct {
    gorm.Model
    Name        string       `json:"name" gorm:"not null;uniqueIndex:idx_channel_group_name"`
    Type        string       `json:"type" gorm:"default:'text'"`
    Description string       `json:"description"`
    GroupID     uint         `json:"groupId" gorm:"uniqueIndex:idx_channel_group_name"`
    Group       ChannelGroup `json:"group"`
    Position    int          `json:"position"`
    CreatedBy   uint         `json:"createdBy"`
    MaxMembers  int          `json:"maxMembers" gorm:"default:0"`
}

// Message 消息模型
type Message struct {
    gorm.Model
    Content   string  `json:"content"`
    SenderID  uint    `json:"sender_id"`
    Sender    User    `json:"sender"`
    ChannelID uint    `json:"channel_id"`
    Channel   Channel `json:"channel"`
}

// Friendship 好友关系模型
type Friendship struct {
    gorm.Model
    UserID   uint `json:"userId" gorm:"not null;uniqueIndex:idx_friendship_pair"`
    User     User `json:"user"`
    FriendID uint `json:"friendId" gorm:"not null;uniqueIndex:idx_friendship_pair"`
    Friend   User `json:"friend"`
}
```

### 响应数据模型（DTO）

```go
// UserResponse 用户响应模型
type UserResponse struct {
    ID        uint       `json:"id"`
    Username  string     `json:"username"`
    Email     string     `json:"email"`
    Avatar    string     `json:"avatar"`
    AvatarURL string     `json:"avatarUrl"`
    Role      string     `json:"role"`
    GroupRole string     `json:"groupRole,omitempty"`
    Bio       string     `json:"bio"`
    IsOnline  bool       `json:"isOnline"`
    LastSeen  *time.Time `json:"lastSeen"`
}

// MessageResponse 消息响应模型
type MessageResponse struct {
    ID        uint            `json:"id"`
    Content   ContentResponse `json:"content"`
    Sender    SenderResponse  `json:"sender"`
    CreatedAt time.Time       `json:"createdAt"`
}
```

---

## 数据访问层（Repository）

**文件**：`backend-go/internal/repository/repository.go`

### 设计模式
- 每个实体对应一个 Repository 结构体
- 使用 GORM 进行数据库操作
- 支持预加载（Preload）关联数据
- 支持复杂查询条件拼接

### UserRepository - 用户数据操作

```go
type UserRepository struct {
    db *gorm.DB
}

// 增 - Create
func (r *UserRepository) Create(user *model.User) error {
    return r.db.Create(user).Error
}

// 查 - Read
func (r *UserRepository) FindByID(id uint) (*model.User, error) {
    var user model.User
    err := r.db.First(&user, id).Error
    return &user, err
}

func (r *UserRepository) FindByEmail(email string) (*model.User, error) {
    var user model.User
    err := r.db.Where("email = ?", email).First(&user).Error
    return &user, err
}

func (r *UserRepository) FindByUsername(username string) (*model.User, error) {
    var user model.User
    err := r.db.Where("username = ?", username).First(&user).Error
    return &user, err
}

// 改 - Update
func (r *UserRepository) Update(user *model.User) error {
    return r.db.Save(user).Error
}

func (r *UserRepository) UpdateProfile(id uint, updates map[string]interface{}) error {
    return r.db.Model(&model.User{}).Where("id = ?", id).Updates(updates).Error
}

// 删 - Delete
func (r *UserRepository) Delete(id uint) error {
    return r.db.Delete(&model.User{}, id).Error
}

// 复杂查询 - Search
func (r *UserRepository) Search(query string, currentUserID uint, limit int) ([]model.User, error) {
    var users []model.User
    pattern := "%" + query + "%"
    err := r.db.Where("id <> ? AND (username ILIKE ? OR email ILIKE ?)", 
        currentUserID, pattern, pattern).
        Limit(limit).
        Find(&users).Error
    return users, err
}
```

### ChannelGroupRepository - 频道组数据操作

```go
type ChannelGroupRepository struct {
    db *gorm.DB
}

// 增 - Create
func (r *ChannelGroupRepository) Create(group *model.ChannelGroup) error {
    return r.db.Create(group).Error
}

// 查 - Read（支持预加载关联数据）
func (r *ChannelGroupRepository) FindByID(id uint) (*model.ChannelGroup, error) {
    var group model.ChannelGroup
    err := r.db.Preload("Channels", func(db *gorm.DB) *gorm.DB {
        return db.Order("position asc, id asc")
    }).Preload("Owner").First(&group, id).Error
    return &group, err
}

func (r *ChannelGroupRepository) FindByUserID(userID uint) ([]model.ChannelGroup, error) {
    var groups []model.ChannelGroup
    err := r.db.Joins("JOIN user_groups ON user_groups.group_id = channel_groups.id").
        Where("user_groups.user_id = ? AND user_groups.deleted_at IS NULL", userID).
        Preload("Channels").
        Find(&groups).Error
    return groups, err
}

// 改 - Update
func (r *ChannelGroupRepository) Update(group *model.ChannelGroup) error {
    return r.db.Save(group).Error
}

// 删 - Delete（硬删除）
func (r *ChannelGroupRepository) Delete(id uint) error {
    return r.db.Unscoped().Delete(&model.ChannelGroup{}, id).Error
}
```

### MessageRepository - 消息数据操作

```go
type MessageRepository struct {
    db *gorm.DB
}

// 增 - Create
func (r *MessageRepository) Create(message *model.Message) error {
    return r.db.Create(message).Error
}

// 查 - Read（复杂查询：分页、时间过滤、搜索）
func (r *MessageRepository) FindByChannelID(
    channelID uint, 
    limit, offset int, 
    day, startAt, endAt *time.Time, 
    queryText string, 
    senderID *uint,
) ([]model.Message, error) {
    var messages []model.Message
    query := r.db.Model(&model.Message{}).
        Select("messages.*").
        Preload("Sender", func(db *gorm.DB) *gorm.DB {
            return db.Select("id", "username", "avatar", "avatar_url", "role")
        }).
        Where("messages.channel_id = ?", channelID).
        Order("messages.created_at desc")

    // 时间范围过滤
    if startAt != nil && endAt != nil {
        query = query.Where("messages.created_at >= ? AND messages.created_at < ?", *startAt, *endAt)
    } else if day != nil {
        start := day.Truncate(24 * time.Hour)
        end := start.Add(24 * time.Hour)
        query = query.Where("messages.created_at >= ? AND messages.created_at < ?", start, end)
    }
    
    // 发送者过滤
    if senderID != nil && *senderID > 0 {
        query = query.Where("messages.sender_id = ?", *senderID)
    }
    
    // 内容搜索（支持用户名搜索）
    if trimmedQuery := strings.TrimSpace(queryText); trimmedQuery != "" {
        pattern := "%" + escapeLikePattern(trimmedQuery) + "%"
        query = query.Joins("LEFT JOIN users ON users.id = messages.sender_id").Where(
            "(messages.content ILIKE ? ESCAPE '\\' OR users.username ILIKE ? ESCAPE '\\')",
            pattern, pattern,
        )
    }

    err := query.Limit(limit).Offset(offset).Find(&messages).Error
    return messages, err
}

// 删 - Delete（软删除）
func (r *MessageRepository) Delete(message *model.Message) error {
    return r.db.Delete(message).Error
}
```

### FriendshipRepository - 好友关系数据操作

```go
type FriendshipRepository struct {
    db *gorm.DB
}

// 增 - CreatePair（创建双向好友关系）
func (r *FriendshipRepository) CreatePair(userA, userB uint) error {
    return r.db.Transaction(func(tx *gorm.DB) error {
        pair := []model.Friendship{
            {UserID: userA, FriendID: userB},
            {UserID: userB, FriendID: userA},
        }
        for _, friendship := range pair {
            var count int64
            tx.Model(&model.Friendship{}).
                Where("user_id = ? AND friend_id = ?", friendship.UserID, friendship.FriendID).
                Count(&count)
            if count == 0 {
                if err := tx.Create(&friendship).Error; err != nil {
                    return err
                }
            }
        }
        return nil
    })
}

// 查 - Read
func (r *FriendshipRepository) FindByUserID(userID uint) ([]model.Friendship, error) {
    var friendships []model.Friendship
    err := r.db.Preload("Friend").
        Where("user_id = ?", userID).
        Order("created_at desc").
        Find(&friendships).Error
    return friendships, err
}

// 删 - DeletePair（删除双向好友关系）
func (r *FriendshipRepository) DeletePair(userA, userB uint) error {
    return r.db.Where(
        "(user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)",
        userA, userB, userB, userA,
    ).Delete(&model.Friendship{}).Error
}
```

---

## 业务逻辑层（Service）

**文件**：`backend-go/internal/service/`

### AuthService - 认证业务逻辑

```go
type AuthService struct {
    userRepo  *repository.UserRepository
    cfg       *config.Config
    redis     *redis.RedisClient
    emailCode *EmailVerificationService
}

// 注册 - Create 操作
func (s *AuthService) Register(input RegisterInput) (*AuthResponse, error) {
    // 1. 验证邮箱验证码
    if s.emailCode != nil {
        if err := s.emailCode.VerifyRegistrationCode(input.Email, input.VerificationCode); err != nil {
            return nil, err
        }
    }

    // 2. 检查邮箱是否已存在
    existingUser, err := s.userRepo.FindByEmail(input.Email)
    if existingUser != nil && existingUser.ID != 0 {
        return nil, errors.New("email already exists")
    }

    // 3. 检查用户名是否已存在
    existingUser, err = s.userRepo.FindByUsername(input.Username)
    if existingUser != nil && existingUser.ID != 0 {
        return nil, errors.New("username already exists")
    }

    // 4. 密码加密
    hashedPassword, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
    
    // 5. 创建用户
    user := &model.User{
        Username: input.Username,
        Email:    input.Email,
        Password: string(hashedPassword),
        Avatar:   string(input.Username[0]),
        Role:     "member",
        IsOnline: true,
    }
    
    if err := s.userRepo.Create(user); err != nil {
        return nil, err
    }

    // 6. 设置在线状态到 Redis
    if s.redis != nil {
        s.redis.SetUserOnline(user.ID, user.Username)
    }

    return &AuthResponse{
        User: model.ToUserResponse(*user),
    }, nil
}

// 登录 - Read 操作
func (s *AuthService) Login(input LoginInput) (*AuthResponse, error) {
    // 1. 查找用户
    user, err := s.userRepo.FindByEmail(input.Email)
    if err != nil {
        return nil, errors.New("invalid credentials")
    }

    // 2. 验证密码
    if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(input.Password)); err != nil {
        return nil, errors.New("invalid credentials")
    }

    // 3. 更新在线状态
    user.IsOnline = true
    user.LastSeen = nil
    s.userRepo.Update(user)

    // 4. 设置 Redis 在线状态
    if s.redis != nil {
        s.redis.SetUserOnline(user.ID, user.Username)
    }

    return &AuthResponse{
        User: model.ToUserResponse(*user),
    }, nil
}

// 更新资料 - Update 操作
func (s *AuthService) UpdateProfile(userID uint, input UpdateProfileInput) (*model.UserResponse, error) {
    updates := map[string]interface{}{}
    
    if input.Username != "" {
        // 检查用户名是否被占用
        existing, err := s.userRepo.FindByUsername(input.Username)
        if err == nil && existing.ID != userID {
            return nil, errors.New("username already taken")
        }
        updates["username"] = input.Username
        updates["avatar"] = string(input.Username[0])
    }
    
    if input.Bio != "" {
        updates["bio"] = input.Bio
    }
    
    if input.AvatarURL != "" {
        updates["avatar_url"] = input.AvatarURL
    }
    
    // 执行更新
    if err := s.userRepo.UpdateProfile(userID, updates); err != nil {
        return nil, err
    }
    
    return s.GetUserResponseByID(userID)
}
```

### FriendService - 好友关系业务逻辑

```go
type FriendService struct {
    userRepo          *repository.UserRepository
    friendRequestRepo *repository.FriendRequestRepository
    friendshipRepo    *repository.FriendshipRepository
}

// 发送好友请求 - Create 操作
func (s *FriendService) CreateFriendRequest(requesterID uint, input CreateFriendRequestInput) (*model.FriendRequestResponse, error) {
    // 1. 解析接收者
    addressee, err := s.resolveAddressee(input)
    
    // 2. 不能添加自己
    if addressee.ID == requesterID {
        return nil, errors.New("cannot add yourself")
    }
    
    // 3. 检查是否已是好友
    if s.friendshipRepo.Exists(requesterID, addressee.ID) {
        return nil, errors.New("already friends")
    }
    
    // 4. 检查是否已有待处理请求
    existing, err := s.friendRequestRepo.FindBetween(requesterID, addressee.ID)
    if err == nil && existing.ID != 0 && existing.Status == "pending" {
        return nil, errors.New("friend request already pending")
    }
    
    // 5. 创建好友请求
    req := &model.FriendRequest{
        RequesterID: requesterID,
        AddresseeID: addressee.ID,
        Status:      "pending",
        Message:     strings.TrimSpace(input.Message),
    }
    if err := s.friendRequestRepo.Create(req); err != nil {
        return nil, err
    }
    
    // 6. 加载完整信息并返回
    loaded, err := s.friendRequestRepo.FindByID(req.ID)
    response := model.ToFriendRequestResponse(*loaded)
    return &response, nil
}

// 接受好友请求 - Update + Create 操作
func (s *FriendService) AcceptFriendRequest(requestID uint, addresseeID uint) (*model.FriendshipResponse, error) {
    // 1. 查找请求
    req, err := s.friendRequestRepo.FindByID(requestID)
    
    // 2. 验证权限
    if req.AddresseeID != addresseeID {
        return nil, errors.New("unauthorized")
    }
    
    // 3. 更新请求状态
    req.Status = "accepted"
    s.friendRequestRepo.Update(req)
    
    // 4. 创建双向好友关系
    if err := s.friendshipRepo.CreatePair(req.RequesterID, req.AddresseeID); err != nil {
        return nil, err
    }
    
    // 5. 返回好友关系
    friendship := &model.Friendship{
        UserID:   addresseeID,
        FriendID: req.RequesterID,
    }
    response := model.ToFriendshipResponse(*friendship)
    return &response, nil
}

// 删除好友 - Delete 操作
func (s *FriendService) RemoveFriend(userID, friendID uint) error {
    // 删除双向好友关系
    return s.friendshipRepo.DeletePair(userID, friendID)
}
```

---

## 接口控制层（Controller）

**文件**：`backend-go/internal/controller/`

### AuthController - 认证接口

```go
type AuthController struct {
    authService *service.AuthService
    cfg         *config.Config
}

// POST /api/auth/register
func (c *AuthController) Register(ctx *gin.Context) {
    var input service.RegisterInput
    if err := ctx.ShouldBindJSON(&input); err != nil {
        response.BadRequest(ctx, err.Error())
        return
    }
    
    result, err := c.authService.Register(input)
    if err != nil {
        response.Error(ctx, 400, err.Error())
        return
    }
    
    // 生成 JWT Token
    token, err := middleware.GenerateToken(result.User.ID, result.User.Username, c.cfg)
    if err != nil {
        response.InternalError(ctx, "Failed to generate token")
        return
    }
    result.AccessToken = token
    
    response.Created(ctx, result)
}

// POST /api/auth/login
func (c *AuthController) Login(ctx *gin.Context) {
    var input service.LoginInput
    if err := ctx.ShouldBindJSON(&input); err != nil {
        response.BadRequest(ctx, err.Error())
        return
    }
    
    result, err := c.authService.Login(input)
    if err != nil {
        response.Unauthorized(ctx, err.Error())
        return
    }
    
    // 生成 JWT Token
    token, err := middleware.GenerateToken(result.User.ID, result.User.Username, c.cfg)
    if err != nil {
        response.InternalError(ctx, "Failed to generate token")
        return
    }
    result.AccessToken = token
    
    response.Success(ctx, result)
}

// PUT /api/users/profile
func (c *AuthController) UpdateProfile(ctx *gin.Context) {
    userID := ctx.GetUint("userID")
    
    var input service.UpdateProfileInput
    if err := ctx.ShouldBindJSON(&input); err != nil {
        response.BadRequest(ctx, err.Error())
        return
    }
    
    result, err := c.authService.UpdateProfile(userID, input)
    if err != nil {
        response.Error(ctx, 400, err.Error())
        return
    }
    
    response.Success(ctx, result)
}
```

### FriendController - 好友接口

```go
type FriendController struct {
    friendService *service.FriendService
}

// POST /api/friends/request
func (c *FriendController) SendRequest(ctx *gin.Context) {
    userID := ctx.GetUint("userID")
    
    var input service.CreateFriendRequestInput
    if err := ctx.ShouldBindJSON(&input); err != nil {
        response.BadRequest(ctx, err.Error())
        return
    }
    
    result, err := c.friendService.CreateFriendRequest(userID, input)
    if err != nil {
        response.Error(ctx, 400, err.Error())
        return
    }
    
    response.Created(ctx, result)
}

// POST /api/friends/accept
func (c *FriendController) AcceptRequest(ctx *gin.Context) {
    userID := ctx.GetUint("userID")
    requestID, _ := strconv.ParseUint(ctx.Param("id"), 10, 32)
    
    result, err := c.friendService.AcceptFriendRequest(uint(requestID), userID)
    if err != nil {
        response.Error(ctx, 400, err.Error())
        return
    }
    
    response.Success(ctx, result)
}

// GET /api/friends
func (c *FriendController) GetFriends(ctx *gin.Context) {
    userID := ctx.GetUint("userID")
    
    result, err := c.friendService.GetFriends(userID)
    if err != nil {
        response.InternalError(ctx, err.Error())
        return
    }
    
    response.Success(ctx, result)
}

// DELETE /api/friends/:id
func (c *FriendController) RemoveFriend(ctx *gin.Context) {
    userID := ctx.GetUint("userID")
    friendID, _ := strconv.ParseUint(ctx.Param("id"), 10, 32)
    
    err := c.friendService.RemoveFriend(userID, uint(friendID))
    if err != nil {
        response.Error(ctx, 400, err.Error())
        return
    }
    
    response.SuccessWithMessage(ctx, nil, "Friend removed successfully")
}
```

---

## CRUD 操作总结

### 各层职责

| 层级 | 职责 | 典型操作 |
|------|------|----------|
| **Model** | 定义数据结构、表关系、响应格式 | struct 定义、JSON 标签、GORM 标签 |
| **Repository** | 纯数据访问、SQL 操作 | Create、First、Where、Save、Delete |
| **Service** | 业务逻辑、数据验证、事务处理 | 调用多个 Repository、业务规则校验 |
| **Controller** | HTTP 接口、参数绑定、响应返回 | ShouldBindJSON、调用 Service、返回 JSON |

### CRUD 操作映射表

| 操作 | User | ChannelGroup | Message | Friendship |
|------|------|--------------|---------|------------|
| **Create** | `Create()` | `Create()` | `Create()` | `CreatePair()` |
| **Read** | `FindByID()`<br>`FindByEmail()`<br>`FindByUsername()`<br>`Search()` | `FindByID()`<br>`FindAll()`<br>`FindByUserID()`<br>`FindByInviteCode()` | `FindByChannelID()`<br>`FindByID()` | `FindByUserID()`<br>`FindBetween()` |
| **Update** | `Update()`<br>`UpdateProfile()` | `Update()` | - | `UpdateRole()` |
| **Delete** | `Delete()` | `Delete()` | `Delete()` | `DeletePair()` |

### 设计特点

1. **Repository 模式**：所有数据库操作封装在 Repository 中，便于测试和替换
2. **依赖注入**：Service 通过构造函数注入 Repository
3. **事务支持**：使用 `db.Transaction()` 保证数据一致性
4. **预加载优化**：使用 `Preload()` 减少 N+1 查询问题
5. **软删除**：GORM 默认支持软删除（gorm.Model 包含 DeletedAt）
6. **双向关系**：好友关系采用双向存储（A->B 和 B->A）
7. **复杂查询**：支持分页、时间过滤、全文搜索等

---

## 附录：完整文件列表

### Repository 层
- `backend-go/internal/repository/repository.go` - 所有实体的 CRUD 操作

### Service 层
- `backend-go/internal/service/auth_service.go` - 认证业务逻辑
- `backend-go/internal/service/friend_service.go` - 好友关系业务逻辑
- `backend-go/internal/service/channel_group_service.go` - 频道组业务逻辑
- `backend-go/internal/service/message_service.go` - 消息业务逻辑

### Controller 层
- `backend-go/internal/controller/auth_controller.go` - 认证接口
- `backend-go/internal/controller/friend_controller.go` - 好友接口
- `backend-go/internal/controller/channel_group_controller.go` - 频道组接口
- `backend-go/internal/controller/message_controller.go` - 消息接口

### Model 层
- `backend-go/internal/model/model.go` - 核心数据模型
- `backend-go/internal/model/group_ai_config.go` - AI 配置模型
- `backend-go/internal/model/wechat_binding.go` - 微信绑定模型

---

**文档生成时间**：2026-06-25
**项目路径**：`c:\1Project\project_web\chatting`
**技术栈**：Go + Gin + GORM + PostgreSQL + Redis