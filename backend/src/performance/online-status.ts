import redisClient from './redis-client';

class OnlineStatusManager {
  /**
   * 设置用户在线状态
   * @param userId 用户ID
   * @param username 用户名
   * @returns Promise<void>
   */
  async setUserOnline(userId: number, username: string): Promise<void> {
    try {
      // 使用Hash存储用户在线状态
      await redisClient.hset('users:online', userId.toString(), JSON.stringify({
        userId,
        username,
        online: true,
        lastSeen: Date.now()
      }));
      // 添加到在线用户集合
      await redisClient.sadd('online:users', userId.toString());
    } catch (error) {
      console.error('Error setting user online status:', error);
    }
  }

  /**
   * 设置用户离线状态
   * @param userId 用户ID
   * @returns Promise<void>
   */
  async setUserOffline(userId: number): Promise<void> {
    try {
      // 从在线用户集合中移除
      await redisClient.srem('online:users', userId.toString());
      // 更新用户状态为离线
      const userData = await redisClient.hget('users:online', userId.toString());
      if (userData) {
        const user = JSON.parse(userData);
        await redisClient.hset('users:online', userId.toString(), JSON.stringify({
          ...user,
          online: false,
          lastSeen: Date.now()
        }));
      }
    } catch (error) {
      console.error('Error setting user offline status:', error);
    }
  }

  /**
   * 检查用户是否在线
   * @param userId 用户ID
   * @returns Promise<boolean>
   */
  async isUserOnline(userId: number): Promise<boolean> {
    try {
      return await redisClient.sismember('online:users', userId.toString()) === 1;
    } catch (error) {
      console.error('Error checking user online status:', error);
      return false;
    }
  }

  /**
   * 获取在线用户列表
   * @returns Promise<Array<{userId: number, username: string}>>
   */
  async getOnlineUsers(): Promise<Array<{ userId: number; username: string }>> {
    try {
      const userIds = await redisClient.smembers('online:users');
      const users: Array<{ userId: number; username: string }> = [];

      for (const userId of userIds) {
        const userData = await redisClient.hget('users:online', userId);
        if (userData) {
          const user = JSON.parse(userData);
          users.push({ userId: user.userId, username: user.username });
        }
      }

      return users;
    } catch (error) {
      console.error('Error getting online users:', error);
      return [];
    }
  }

  /**
   * 将用户添加到频道
   * @param userId 用户ID
   * @param channelId 频道ID
   * @returns Promise<void>
   */
  async addUserToChannel(userId: number, channelId: number): Promise<void> {
    try {
      // 将用户添加到频道的成员集合
      await redisClient.sadd(`channel:${channelId}:members`, userId.toString());
      // 将频道添加到用户的频道集合
      await redisClient.sadd(`user:${userId}:channels`, channelId.toString());
    } catch (error) {
      console.error('Error adding user to channel:', error);
    }
  }

  /**
   * 将用户从频道移除
   * @param userId 用户ID
   * @param channelId 频道ID
   * @returns Promise<void>
   */
  async removeUserFromChannel(userId: number, channelId: number): Promise<void> {
    try {
      // 从频道的成员集合中移除用户
      await redisClient.srem(`channel:${channelId}:members`, userId.toString());
      // 从用户的频道集合中移除频道
      await redisClient.srem(`user:${userId}:channels`, channelId.toString());
    } catch (error) {
      console.error('Error removing user from channel:', error);
    }
  }

  /**
   * 获取频道的在线成员
   * @param channelId 频道ID
   * @returns Promise<Array<{userId: number, username: string}>>
   */
  async getChannelOnlineMembers(channelId: number): Promise<Array<{ userId: number; username: string }>> {
    try {
      // 获取频道的所有成员
      const channelMembers = await redisClient.smembers(`channel:${channelId}:members`);
      const onlineMembers: Array<{ userId: number; username: string }> = [];

      for (const userId of channelMembers) {
        // 检查用户是否在线
        if (await this.isUserOnline(parseInt(userId, 10))) {
          const userData = await redisClient.hget('users:online', userId);
          if (userData) {
            const user = JSON.parse(userData);
            onlineMembers.push({ userId: user.userId, username: user.username });
          }
        }
      }

      return onlineMembers;
    } catch (error) {
      console.error('Error getting channel online members:', error);
      return [];
    }
  }
}

export const onlineStatusManager = new OnlineStatusManager();
export default onlineStatusManager;
