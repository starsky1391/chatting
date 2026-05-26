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
