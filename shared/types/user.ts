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
