// 前端配置管理
export const config = {
  // API 服务器配置
  api: {
    baseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
    socketUrl: process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001'
  },
  
  // WebRTC 配置
  webrtc: {
    iceServers: [
      {
        urls: 'stun:stun.l.google.com:19302'
      },
      {
        urls: 'stun:stun1.l.google.com:19302'
      }
      // 可选：添加 TURN 服务器配置
      // {
      //   urls: process.env.NEXT_PUBLIC_TURN_URL || '',
      //   username: process.env.NEXT_PUBLIC_TURN_USERNAME || '',
      //   credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL || ''
      // }
    ]
  },
  
  // 应用配置
  app: {
    env: process.env.NODE_ENV || 'development',
    debug: process.env.NODE_ENV === 'development'
  },
  
  // 默认值配置
  defaults: {
    avatar: 'https://via.placeholder.com/40'
  }
};
