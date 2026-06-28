# AI聊天记录总结与语音屏幕共享 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为聊天系统添加AI聊天记录总结功能和语音频道屏幕共享功能

**Architecture:** 
- AI总结：后端识别总结指令 → 查询消息 → 调用AI → 以AI身份回复
- 屏幕共享：前端LiveKit屏幕共享轨道 → 小窗/全屏UI → 状态管理

**Tech Stack:** Next.js 16 + React 19 + Go 1.23 + LiveKit + Tailwind CSS + Zustand

## Global Constraints

- Go版本: 1.23.0
- Next.js版本: 16.1.4
- React版本: 19.2.3
- LiveKit Client: ^2.18.9
- 遵循现有代码风格和命名规范
- 保持向后兼容

---

## Task 1: AI总结指令识别与消息查询

**Files:**
- Modify: `backend-go/internal/service/message_service.go`

**Interfaces:**
- Consumes: 现有 `shouldAskAI`, `extractAIPrompt`, `buildAIReply` 方法
- Produces: `summarizeChannelMessages` 方法, 增强的AI指令识别

- [ ] **Step 1: 在 `shouldAskAI` 中识别总结指令**

在 `mentionsAI` 函数后添加总结指令识别：

```go
func isSummarizeRequest(content string) bool {
	lower := strings.ToLower(strings.TrimSpace(content))
	return strings.Contains(lower, "总结聊天记录") ||
		strings.Contains(lower, "summarize messages") ||
		strings.Contains(lower, "总结")
}
```

- [ ] **Step 2: 在 `extractAIPrompt` 中提取时间段参数**

```go
func extractSummarizeParams(content string) (command string, period string) {
	lower := strings.ToLower(strings.TrimSpace(content))
	
	// 提取时间段
	period = "today" // 默认今天
	if strings.Contains(lower, "最近7天") || strings.Contains(lower, "7天") {
		period = "last7days"
	} else if strings.Contains(lower, "最近30天") || strings.Contains(lower, "30天") {
		period = "last30days"
	} else if strings.Contains(lower, "今天") || strings.Contains(lower, "today") {
		period = "today"
	}
	
	return "summarize", period
}
```

- [ ] **Step 3: 新增 `summarizeChannelMessages` 方法**

```go
func (s *MessageService) summarizeChannelMessages(channelID uint, period string) (string, error) {
	// 根据时间段计算时间范围
	now := time.Now()
	var startAt, endAt time.Time
	
	switch period {
	case "last7days":
		startAt = now.AddDate(0, 0, -7)
	case "last30days":
		startAt = now.AddDate(0, 0, -30)
	case "today":
		startAt = time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	default:
		startAt = now.AddDate(0, 0, -1)
	}
	endAt = now
	
	// 查询消息
	messages, err := s.messageRepo.FindByChannelIDAndTimeRange(channelID, startAt, endAt)
	if err != nil {
		return "", err
	}
	
	if len(messages) == 0 {
		return "该时间段内没有消息可总结。", nil
	}
	
	// 构建总结prompt
	var sb strings.Builder
	sb.WriteString("请总结以下聊天记录的主要内容和要点：\n\n")
	for _, msg := range messages {
		sb.WriteString(fmt.Sprintf("[%s] %s: %s\n", 
			msg.CreatedAt.Format("2006-01-02 15:04"),
			msg.Sender.Username,
			msg.Content))
	}
	
	return sb.String(), nil
}
```

- [ ] **Step 4: 修改 `buildAIReply` 处理总结指令**

```go
func (s *MessageService) buildAIReply(channelID uint, prompt string) (*model.User, string, error) {
	// ... 现有代码 ...
	
	// 检查是否为总结请求
	if isSummarizeRequest(prompt) {
		_, period := extractSummarizeParams(prompt)
		summaryPrompt, err := s.summarizeChannelMessages(channelID, period)
		if err != nil {
			return bot, "", err
		}
		
		// 调用AI进行总结
		ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
		defer cancel()
		
		answer, err := s.aiService.AskWithConfig(ctx, summaryPrompt, configFromGroupAIConfig(groupConfig))
		if err != nil {
			return bot, "", err
		}
		
		if _, err := s.createMessageAs(bot.ID, channelID, answer); err != nil {
			return bot, "", err
		}
		return bot, answer, nil
	}
	
	// ... 现有AI回复逻辑 ...
}
```

- [ ] **Step 5: Commit**

```bash
git add backend-go/internal/service/message_service.go
git commit -m "feat: add AI chat summary feature"
```

---

## Task 2: 前端屏幕共享状态管理

**Files:**
- Modify: `frontend/src/store/useChatStore.ts`

**Interfaces:**
- Consumes: 现有 ChatState 接口
- Produces: 屏幕共享相关状态和方法

- [ ] **Step 1: 在 ChatState 接口中添加屏幕共享状态**

```typescript
export interface ChatState {
  // ... 现有状态 ...
  
  // 屏幕共享相关
  isScreenSharing: boolean;
  screenShareParticipant: string | null;
  isScreenShareExpanded: boolean;
  screenShareTrack: MediaStreamTrack | null;
  
  setScreenSharing: (isSharing: boolean) => void;
  setScreenShareParticipant: (participant: string | null) => void;
  setScreenShareExpanded: (isExpanded: boolean) => void;
  setScreenShareTrack: (track: MediaStreamTrack | null) => void;
}
```

- [ ] **Step 2: 在 store 实现中添加屏幕共享状态**

```typescript
export const useChatStore = create<ChatState>((set) => {
  return {
    // ... 现有状态 ...
    
    // 屏幕共享状态
    isScreenSharing: false,
    screenShareParticipant: null,
    isScreenShareExpanded: false,
    screenShareTrack: null,
    
    setScreenSharing: (isSharing) => set({ isScreenSharing: isSharing }),
    setScreenShareParticipant: (participant) => set({ screenShareParticipant: participant }),
    setScreenShareExpanded: (isExpanded) => set({ isScreenShareExpanded: isExpanded }),
    setScreenShareTrack: (track) => set({ screenShareTrack: track }),
  };
});
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/store/useChatStore.ts
git commit -m "feat: add screen share state management"
```

---

## Task 3: 创建 ScreenShareWindow 组件

**Files:**
- Create: `frontend/src/components/voice/ScreenShareWindow.tsx`

**Interfaces:**
- Consumes: ChatState 中的屏幕共享状态
- Produces: 可复用的屏幕共享显示组件

- [ ] **Step 1: 创建 ScreenShareWindow 组件**

```typescript
"use client";

import React, { useRef, useEffect } from 'react';
import { Maximize2, Minimize2, X } from 'lucide-react';
import { useChatStore } from '@/store/useChatStore';

interface ScreenShareWindowProps {
  track: MediaStreamTrack;
  participantName: string;
  onClose: () => void;
}

export default function ScreenShareWindow({ track, participantName, onClose }: ScreenShareWindowProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const isExpanded = useChatStore((state) => state.isScreenShareExpanded);
  const setIsExpanded = useChatStore((state) => state.setScreenShareExpanded);

  useEffect(() => {
    if (videoRef.current && track) {
      const stream = new MediaStream([track]);
      videoRef.current.srcObject = stream;
    }
  }, [track]);

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  if (isExpanded) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90">
        <div className="relative w-full h-full max-w-7xl max-h-screen p-4">
          <div className="absolute top-4 right-4 flex gap-2 z-10">
            <button
              onClick={toggleExpand}
              className="p-2 rounded-lg bg-zinc-800/80 text-white hover:bg-zinc-700"
              title="缩小"
            >
              <Minimize2 className="w-5 h-5" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-red-500/80 text-white hover:bg-red-600"
              title="关闭"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="absolute top-4 left-4 z-10">
            <span className="px-3 py-1 rounded-lg bg-zinc-800/80 text-white text-sm">
              {participantName} 的屏幕共享
            </span>
          </div>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full h-full object-contain rounded-lg"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-40 w-80 rounded-lg border border-zinc-700 bg-zinc-900/95 shadow-2xl overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-700">
        <span className="text-sm text-white truncate">{participantName} 的屏幕</span>
        <div className="flex gap-1">
          <button
            onClick={toggleExpand}
            className="p-1 rounded hover:bg-zinc-700 text-zinc-300"
            title="放大"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-red-500/20 text-zinc-300 hover:text-red-400"
            title="关闭"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="relative aspect-video bg-zinc-950">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="w-full h-full object-contain"
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/voice/ScreenShareWindow.tsx
git commit -m "feat: add ScreenShareWindow component"
```

---

## Task 4: 在 VoiceSessionDock 中添加屏幕共享功能

**Files:**
- Modify: `frontend/src/components/voice/VoiceSessionDock.tsx`

**Interfaces:**
- Consumes: ChatState 屏幕共享状态, ScreenShareWindow 组件
- Produces: 完整的屏幕共享用户交互

- [ ] **Step 1: 导入 ScreenShareWindow 和添加屏幕共享状态**

```typescript
import ScreenShareWindow from './ScreenShareWindow';
import { Monitor } from 'lucide-react'; // 添加到现有导入
```

- [ ] **Step 2: 在 VoiceSessionDock 中添加屏幕共享逻辑**

```typescript
export default function VoiceSessionDock() {
  // ... 现有状态 ...
  
  // 屏幕共享状态
  const isScreenSharing = useChatStore((state) => state.isScreenSharing);
  const screenShareParticipant = useChatStore((state) => state.screenShareParticipant);
  const screenShareTrack = useChatStore((state) => state.screenShareTrack);
  const setScreenSharing = useChatStore((state) => state.setScreenSharing);
  const setScreenShareParticipant = useChatStore((state) => state.setScreenShareParticipant);
  const setScreenShareTrack = useChatStore((state) => state.setScreenShareTrack);
  
  // ... 现有代码 ...
  
  // 开始屏幕共享
  const startScreenShare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always' as const },
        audio: false,
      });
      
      const track = stream.getVideoTracks()[0];
      if (!track) return;
      
      // 通过LiveKit发布屏幕共享轨道
      const livekit = await loadLiveKit();
      const room = roomRef.current;
      if (!room) return;
      
      const screenTrack = new livekit.LocalVideoTrack(track, undefined, true);
      await room.localParticipant.publishTrack(screenTrack, {
        source: livekit.Track.Source.ScreenShare,
      });
      
      setScreenSharing(true);
      setScreenShareTrack(track);
      setScreenShareParticipant(currentUser?.username || 'You');
      
      // 监听轨道结束
      track.addEventListener('ended', () => {
        stopScreenShare();
      });
    } catch (err) {
      console.error('Failed to start screen share:', err);
    }
  };
  
  // 停止屏幕共享
  const stopScreenShare = async () => {
    const room = roomRef.current;
    if (room) {
      // 取消发布所有屏幕共享轨道
      room.localParticipant.trackPublications.forEach((pub) => {
        if (pub.track?.source === 'screen_share') {
          room.localParticipant.unpublishTrack(pub.track);
        }
      });
    }
    
    setScreenSharing(false);
    setScreenShareTrack(null);
    setScreenShareParticipant(null);
  };
  
  // ... 现有代码 ...
}
```

- [ ] **Step 3: 在UI中添加屏幕共享按钮**

在控制按钮区域添加：

```tsx
{/* 屏幕共享按钮 */}
{isInCall && (
  <button
    type="button"
    onClick={isScreenSharing ? stopScreenShare : startScreenShare}
    className={buttonClass(isScreenSharing)}
    title={isScreenSharing ? '停止共享' : '共享屏幕'}
  >
    <Monitor className="h-5 w-5" />
  </button>
)}
```

- [ ] **Step 4: 添加 ScreenShareWindow 渲染**

在组件返回的JSX中添加：

```tsx
{/* 屏幕共享窗口 */}
{screenShareTrack && (
  <ScreenShareWindow
    track={screenShareTrack}
    participantName={screenShareParticipant || 'Unknown'}
    onClose={stopScreenShare}
  />
)}
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/voice/VoiceSessionDock.tsx
git commit -m "feat: add screen share functionality to VoiceSessionDock"
```

---

## Task 5: 处理远程参与者的屏幕共享

**Files:**
- Modify: `frontend/src/components/voice/VoiceSessionDock.tsx`

**Interfaces:**
- Consumes: LiveKit TrackSubscribed 事件
- Produces: 远程屏幕共享显示

- [ ] **Step 1: 在 LiveKit 事件监听中处理屏幕共享轨道**

在 `joinVoiceChannel` 方法的 `TrackSubscribed` 事件处理中添加：

```typescript
room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
  if (track.kind === Track.Kind.Video && publication.source === Track.Source.ScreenShare) {
    // 这是屏幕共享轨道
    const videoElement = track.attach() as HTMLVideoElement;
    videoElement.id = `screen-share-${participant.identity}`;
    videoElement.autoplay = true;
    videoElement.playsInline = true;
    
    // 更新store状态
    setScreenShareTrack(track.mediaStreamTrack);
    setScreenShareParticipant(participant.name || participant.identity);
    
    return;
  }
  
  if (track.kind !== Track.Kind.Audio) return;
  // ... 现有音频处理 ...
});
```

- [ ] **Step 2: 在 TrackUnsubscribed 中处理屏幕共享结束**

```typescript
room.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
  if (track.kind === Track.Kind.Video && publication.source === Track.Source.ScreenShare) {
    track.detach().forEach((element) => element.remove());
    
    // 清除store状态
    setScreenShareTrack(null);
    setScreenShareParticipant(null);
    
    return;
  }
  
  if (track.kind !== Track.Kind.Audio) return;
  // ... 现有音频处理 ...
});
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/voice/VoiceSessionDock.tsx
git commit -m "feat: handle remote screen share tracks"
```

---

## Task 6: 测试验证

**Files:**
- 无需修改文件，执行测试命令

- [ ] **Step 1: 测试AI总结功能**

1. 启动后端服务
2. 在聊天频道发送：`@AI 总结聊天记录 今天`
3. 验证AI是否回复总结内容

- [ ] **Step 2: 测试屏幕共享功能**

1. 启动前端服务
2. 进入语音频道
3. 点击"共享屏幕"按钮
4. 验证屏幕共享窗口是否正常显示
5. 验证小窗/全屏切换功能
6. 验证其他参与者是否能看到共享画面

- [ ] **Step 3: Commit**

```bash
git commit -m "test: verify AI summary and screen share features"
```

---

## 总结

本计划包含6个任务，按顺序执行：

1. **Task 1:** 后端AI总结指令识别与消息查询
2. **Task 2:** 前端屏幕共享状态管理
3. **Task 3:** 创建 ScreenShareWindow 组件
4. **Task 4:** 在 VoiceSessionDock 中添加屏幕共享功能
5. **Task 5:** 处理远程参与者的屏幕共享
6. **Task 6:** 测试验证

每个任务完成后需要commit，确保代码可追溯。
