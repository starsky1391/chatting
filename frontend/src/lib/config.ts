// 前端配置管理
// NEXT_PUBLIC_API_URL 可选值：
//   - 空字符串或 "/" → 相对路径（nginx 反代生产环境）
//   - "/api"         → 代码会自动去掉前缀，避免双 /api
//   - "http://host"  → 完整地址（开发环境）

const _RAW_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

// 如果值是 /api 或 /api/，去掉它（前端代码已包含 /api 前缀）
const API_URL = (_RAW_URL === '/api' || _RAW_URL === '/api/') ? '' : _RAW_URL;

// 自动推导 WebSocket URL
const getSocketUrl = (apiUrl: string): string => {
  if (!apiUrl) return '';
  if (apiUrl.startsWith('https://')) return apiUrl;
  if (apiUrl.startsWith('http://')) return apiUrl;
  return '';
};

export const config = {
  api: {
    baseUrl: API_URL,
    socketUrl: getSocketUrl(API_URL)
  },

  webrtc: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      ...(process.env.NEXT_PUBLIC_TURN_URL
        ? [{
            urls: process.env.NEXT_PUBLIC_TURN_URL.split(',').map(u => u.trim()),
            username: process.env.NEXT_PUBLIC_TURN_USERNAME || '',
            credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL || ''
          }]
        : [])
    ] as RTCIceServer[]
  },

  app: {
    env: process.env.NODE_ENV || 'development',
    debug: process.env.NODE_ENV === 'development'
  },

  defaults: {
    avatar: 'https://via.placeholder.com/40'
  }
};
