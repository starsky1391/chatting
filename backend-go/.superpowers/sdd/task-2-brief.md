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

