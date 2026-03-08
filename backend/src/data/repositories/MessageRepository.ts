import { Message } from '../../models/Message';
import { User } from '../../models/User';

interface MessageQueryOptions {
  limit?: number;
  before?: Date;
  after?: Date;
}

export class MessageRepository {
  /**
   * Get messages by channel ID with sender information
   * @param channelId Channel ID
   * @param options Query options
   * @returns Promise<Message[]>
   */
  async getMessagesByChannelId(channelId: number, options: MessageQueryOptions = {}): Promise<Message[]> {
    const { limit = 50, before, after } = options;

    const queryOptions: any = {
      where: { channelId },
      limit,
      order: [['createdAt', 'DESC']],
      include: [
        {
          model: User,
          as: 'sender',
          attributes: ['id', 'username', 'avatar']
        }
      ]
    };

    // 基于时间戳的分页
    if (before) {
      queryOptions.where.createdAt = {
        [Symbol.for('lt')]: before
      };
    } else if (after) {
      queryOptions.where.createdAt = {
        [Symbol.for('gt')]: after
      };
      queryOptions.order = [['createdAt', 'ASC']];
    }

    return await Message.findAll(queryOptions);
  }

  /**
   * Create a new message
   * @param messageData Message data
   * @returns Promise<Message>
   */
  async createMessage(messageData: {
    content: string;
    senderId: number;
    channelId: number;
    metadata?: Record<string, any>;
  }): Promise<Message> {
    return await Message.create({
      content: { type: 'text', body: messageData.content },
      senderId: messageData.senderId,
      channelId: messageData.channelId,
      // 如果有扩展信息，存储到JSONB字段
      metadata: messageData.metadata
    });
  }

  /**
   * Get message by ID with sender information
   * @param id Message ID
   * @returns Promise<Message | null>
   */
  async getMessageById(id: number): Promise<Message | null> {
    return await Message.findByPk(id, {
      include: [
        {
          model: User,
          as: 'sender',
          attributes: ['id', 'username', 'avatar']
        }
      ]
    });
  }
}

export const messageRepository = new MessageRepository();
export default messageRepository;
