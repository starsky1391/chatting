import jwt from 'jsonwebtoken';
import config from '../config';

interface TokenPayload {
  userId: number;
  username: string;
  type: 'access' | 'refresh';
}

interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: number;
  refreshTokenExpiresAt: number;
}

export class JWTUtil {
  /**
   * 生成双Token
   * @param userId 用户ID
   * @param username 用户名
   * @returns 包含accessToken和refreshToken的对象
   */
  static generateTokens(userId: number, username: string): TokenResponse {
    // 计算过期时间
    const accessTokenExpiresAt = Date.now() + this.getExpirationTime(config.jwt.accessTokenExpiresIn);
    const refreshTokenExpiresAt = Date.now() + this.getExpirationTime(config.jwt.refreshTokenExpiresIn);

    // 生成accessToken
    const accessToken = (jwt as any).sign(
      { userId, username, type: 'access' },
      config.jwt.secret,
      { expiresIn: config.jwt.accessTokenExpiresIn }
    );

    // 生成refreshToken
    const refreshToken = (jwt as any).sign(
      { userId, username, type: 'refresh' },
      config.jwt.secret,
      { expiresIn: config.jwt.refreshTokenExpiresIn }
    );

    return {
      accessToken,
      refreshToken,
      accessTokenExpiresAt,
      refreshTokenExpiresAt
    };
  }

  /**
   * 验证Token
   * @param token JWT令牌
   * @returns 解码后的payload
   */
  static verifyToken(token: string): TokenPayload {
    try {
      return jwt.verify(token, config.jwt.secret) as TokenPayload;
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  /**
   * 刷新Token
   * @param refreshToken 刷新令牌
   * @returns 新的accessToken
   */
  static refreshToken(refreshToken: string): string {
    const payload = this.verifyToken(refreshToken);

    // 验证是否为refreshToken
    if (payload.type !== 'refresh') {
      throw new Error('Invalid refresh token');
    }

    // 生成新的accessToken
    const newAccessToken = (jwt as any).sign(
      { userId: payload.userId, username: payload.username, type: 'access' },
      config.jwt.secret,
      { expiresIn: config.jwt.accessTokenExpiresIn }
    );

    return newAccessToken;
  }

  /**
   * 将过期时间字符串转换为毫秒
   * @param expiresIn 过期时间字符串，如 '15m', '7d'
   * @returns 毫秒数
   */
  private static getExpirationTime(expiresIn: string): number {
    const match = expiresIn.match(/(\d+)([mhd])/);
    if (!match) {
      return 15 * 60 * 1000; // 默认15分钟
    }

    const [, value, unit] = match;
    const numValue = parseInt(value, 10);

    switch (unit) {
      case 'm':
        return numValue * 60 * 1000;
      case 'h':
        return numValue * 60 * 60 * 1000;
      case 'd':
        return numValue * 24 * 60 * 60 * 1000;
      default:
        return 15 * 60 * 1000;
    }
  }
}
