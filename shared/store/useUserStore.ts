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
