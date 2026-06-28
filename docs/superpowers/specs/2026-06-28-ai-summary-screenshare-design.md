# AI聊天记录总结与语音屏幕共享 设计文档

> **日期:** 2026-06-28
> **版本:** 1.0

## 概述

为聊天系统添加两个功能：
1. **AI机器人总结聊天记录** — 用户通过 `@AI 总结聊天记录 [时间段]` 指令触发
2. **语音频道屏幕共享** — 基于LiveKit的屏幕共享，默认关闭，有人使用时小窗显示，可放大

## 技术栈

- **前端:** Next.js 16 + React 19 + TypeScript + Tailwind CSS + Zustand + LiveKit Client
- **后端:** Go 1.23 + Gin + GORM + LiveKit Server
- **实时通信:** WebSocket + LiveKit

---

## 功能一：AI聊天记录总结

### 触发方式

用户在聊天框输入：`@AI 总结聊天记录 [时间段]`

支持的时间段：
- `今天` — 总结今天的消息
- `最近7天` — 总结最近7天的消息
- `最近30天` — 总结最近30天的消息

### 后端实现

**文件改动：**

1. **`backend-go/internal/service/message_service.go`**
   - 修改 `shouldAskAI` 方法：识别"总结聊天记录"指令
   - 修改 `extractAIPrompt` 方法：提取时间段参数
   - 新增 `summarizeChannelMessages` 方法：查询消息并调用AI总结
   - 新增 `buildAIReply` 分支：处理总结指令

2. **`backend-go/internal/service/ai_service.go`**
   - 新增 `SummarizeMessages` 方法：接收消息列表，调用AI进行总结

**数据流：**
```
用户发送 @AI 总结聊天记录 今天
    ↓
MessageService.shouldAskAI() 识别为AI指令
    ↓
MessageService.buildAIReply() 判断为总结指令
    ↓
SummarizeChannelMessages() 查询今天消息
    ↓
AIService.SummarizeMessages() 调用AI接口
    ↓
AI生成总结 → 以AI机器人身份回复到频道
```

### 前端实现

无需新增UI组件，总结结果通过现有消息系统展示。

---

## 功能二：语音频道屏幕共享

### 用户交互流程

1. 用户进入语音频道
2. 点击"共享屏幕"按钮
3. 浏览器弹出屏幕选择对话框
4. 选择屏幕后，其他参与者看到小窗显示共享画面
5. 点击小窗可放大到全屏
6. 再次点击或按ESC缩小回小窗

### 前端实现

**文件改动：**

1. **`frontend/src/components/voice/ScreenShareWindow.tsx`** (新建)
   - 小窗/全屏显示共享画面
   - 支持点击切换大小
   - 显示共享者信息

2. **`frontend/src/components/voice/VoiceSessionDock.tsx`**
   - 添加"共享屏幕"按钮
   - 管理屏幕共享状态
   - 显示/隐藏 ScreenShareWindow

3. **`frontend/src/store/useChatStore.ts`**
   - 新增状态：`isScreenSharing`、`screenShareParticipant`、`isScreenShareExpanded`

### 后端实现

无需后端改动，LiveKit处理所有屏幕共享信令。

---

## 错误处理

### AI总结
- 时间段格式错误 → AI回复"请使用正确的格式：@AI 总结聊天记录 [今天/最近7天/最近30天]"
- 该时间段无消息 → AI回复"该时间段内没有消息可总结"
- AI接口调用失败 → 重试3次后回复"总结失败，请稍后重试"

### 屏幕共享
- 用户拒绝屏幕共享权限 → 显示提示"请允许屏幕共享权限"
- 共享者离开语音频道 → 自动停止共享
- 网络中断 → 显示"共享已断开"提示

---

## 测试策略

### AI总结
- 单元测试：测试 `extractAIPrompt` 的时间段提取逻辑
- 单元测试：测试 `shouldAskAI` 的指令识别
- 集成测试：测试完整总结流程

### 屏幕共享
- 手动测试：验证共享屏幕功能正常
- 手动测试：验证小窗/全屏切换
- 手动测试：验证多用户同时共享场景

---

## 安全考虑

- AI总结：限制每次总结的消息数量上限（如500条），防止API滥用
- 屏幕共享：仅语音频道参与者可见，离开频道自动停止共享
