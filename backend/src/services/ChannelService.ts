import { Channel } from '../models/Channel';
import { User } from '../models/User';
import { UserChannel } from '../models/UserChannel';

export class ChannelService {
  /**
   * Get all channels for a specific user
   */
  async getAllChannelsForUser(userId: number): Promise<Channel[]> {
    try {
      console.log('Getting channels for user:', userId);
      // 方法1：使用JOIN查询获取用户的频道
      const channels = await Channel.findAll({
        include: [{
          model: User,
          as: 'members',
          where: { id: userId },
          attributes: [],
          through: { attributes: [] }
        }]
      });
      console.log('Channels found for user:', channels.length);
      return channels;
    } catch (error) {
      console.error('Error getting channels for user:', error);
      return [];
    }
  }

  /**
   * Get channel by ID
   */
  async getChannelById(id: number): Promise<Channel | null> {
    return Channel.findByPk(id);
  }

  /**
   * Get channel by name
   */
  async getChannelByName(name: string): Promise<Channel | null> {
    return Channel.findOne({
      where: { name }
    });
  }

  /**
   * Create a new channel
   */
  async createChannel(channelData: {
    name: string;
    type: 'text' | 'voice' | 'video';
    description?: string;
    creatorId: number;
  }): Promise<Channel> {
    try {
      console.log('Creating channel with data:', channelData);
      // 创建新频道
      const newChannel = await Channel.create({
        name: channelData.name,
        type: channelData.type,
        description: channelData.description || null
      });
      console.log('Channel created successfully:', newChannel);

      // 将创建者添加到频道成员表中，角色为admin
      console.log('Adding creator to user_channels:', { userId: channelData.creatorId, channelId: newChannel.id, role: 'admin' });
      await UserChannel.create({
        userId: channelData.creatorId,
        channelId: newChannel.id,
        role: 'admin'
      });
      console.log('Creator added to channel members successfully');

      return newChannel;
    } catch (error) {
      console.error('Error creating channel:', error);
      throw error;
    }
  }

  /**
   * Get channel members using UserChannel relation
   */
  async getChannelMembers(channelId: number): Promise<User[]> {
    const channel = await Channel.findByPk(channelId, {
      include: [{
        model: User,
        as: 'members',
        attributes: ['id', 'username', 'avatar', 'status', 'role', 'createdAt', 'updatedAt'],
        through: { attributes: ['role'] }
      }]
    });

    return channel ? (channel as any).members : [];
  }

  /**
   * Join a channel
   */
  async joinChannel(userId: number, channelId: number): Promise<UserChannel> {
    return UserChannel.create({
      userId,
      channelId,
      role: 'member'
    });
  }

  /**
   * Leave a channel
   */
  async leaveChannel(userId: number, channelId: number): Promise<boolean> {
    const result = await UserChannel.destroy({
      where: {
        userId,
        channelId
      }
    });
    return result > 0;
  }

  /**
   * Get all users (for various purposes)
   */
  async getAllUsers(): Promise<User[]> {
    return User.findAll({
      attributes: ['id', 'username', 'avatar', 'status', 'role', 'createdAt', 'updatedAt']
    });
  }

  /**
   * Check if a user is in a channel
   */
  async isUserInChannel(userId: number, channelId: number): Promise<boolean> {
    const userChannel = await UserChannel.findOne({
      where: {
        userId,
        channelId
      }
    });
    return !!userChannel;
  }
}