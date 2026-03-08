import { JWTUtil } from '../jwt';

describe('JWTUtil', () => {
  const userId = 1;
  const username = 'testuser';

  test('should generate tokens with correct structure', () => {
    const tokens = JWTUtil.generateTokens(userId, username);

    expect(tokens).toHaveProperty('accessToken');
    expect(tokens).toHaveProperty('refreshToken');
    expect(tokens).toHaveProperty('accessTokenExpiresAt');
    expect(tokens).toHaveProperty('refreshTokenExpiresAt');

    expect(typeof tokens.accessToken).toBe('string');
    expect(typeof tokens.refreshToken).toBe('string');
    expect(typeof tokens.accessTokenExpiresAt).toBe('number');
    expect(typeof tokens.refreshTokenExpiresAt).toBe('number');
  });

  test('should verify access token correctly', () => {
    const tokens = JWTUtil.generateTokens(userId, username);
    const decoded = JWTUtil.verifyToken(tokens.accessToken);

    expect(decoded.userId).toBe(userId);
    expect(decoded.username).toBe(username);
    expect(decoded.type).toBe('access');
  });

  test('should verify refresh token correctly', () => {
    const tokens = JWTUtil.generateTokens(userId, username);
    const decoded = JWTUtil.verifyToken(tokens.refreshToken);

    expect(decoded.userId).toBe(userId);
    expect(decoded.username).toBe(username);
    expect(decoded.type).toBe('refresh');
  });

  test('should refresh access token correctly', () => {
    const tokens = JWTUtil.generateTokens(userId, username);
    const newAccessToken = JWTUtil.refreshToken(tokens.refreshToken);

    expect(typeof newAccessToken).toBe('string');

    const decoded = JWTUtil.verifyToken(newAccessToken);
    expect(decoded.userId).toBe(userId);
    expect(decoded.username).toBe(username);
    expect(decoded.type).toBe('access');
  });

  test('should throw error for invalid token', () => {
    expect(() => {
      JWTUtil.verifyToken('invalid-token');
    }).toThrow('Invalid or expired token');
  });

  test('should throw error when trying to refresh with access token', () => {
    const tokens = JWTUtil.generateTokens(userId, username);
    expect(() => {
      JWTUtil.refreshToken(tokens.accessToken);
    }).toThrow('Invalid refresh token');
  });
});
